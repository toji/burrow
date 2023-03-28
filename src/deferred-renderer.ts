import { TextureVisualizer } from './texture-visualizer.js'
import { gBufferShader, lightingShader } from './shaders/deferred.js';
import { mat4, vec3 } from '../node_modules/gl-matrix/esm/index.js';
import { Mesh, createTempMesh } from './cube-mesh.js';
import { LightSpriteRenderer } from './light-sprite.js';

export enum DebugViewType {
  none = "none",
  all = "all",
  rgba = "rgba",
  normal = "normal",
  metalRough = "metalRough",
  light = "light",
  depth = "depth",
};

interface Camera {
  viewMatrix: mat4,
  position: vec3,
}

const MAX_LIGHTS = 64;
const LIGHT_STRUCT_SIZE = 32;
const LIGHT_BUFFER_SIZE = (MAX_LIGHTS * LIGHT_STRUCT_SIZE) + 16;

const LIGHT_COUNT = 6;

export class DeferredRenderer {
  attachmentSize: GPUExtent3DDictStrict = { width: 0, height: 0 }

  rgbaTexture: GPUTexture;
  normalTexture: GPUTexture;
  metalRoughTexture: GPUTexture;
  lightTexture: GPUTexture;
  depthTexture: GPUTexture;

  colorAttachments: GPURenderPassColorAttachment[];
  lightAttachments: GPURenderPassColorAttachment[];
  depthAttachment: GPURenderPassDepthStencilAttachment;

  textureVisualizer: TextureVisualizer;

  debugView: DebugViewType = DebugViewType.all;

  frameBindGroupLayout: GPUBindGroupLayout;
  frameBindGroup: GPUBindGroup;
  cameraBuffer: GPUBuffer;
  lightBuffer: GPUBuffer;
  lightArrayBuffer: ArrayBuffer;

  gBufferBindGroupLayout: GPUBindGroupLayout;
  gBufferBindGroup: GPUBindGroup;

  lightingPipeline: GPURenderPipeline;

  lightSpriteRenderer: LightSpriteRenderer;

  tempPipeline: GPURenderPipeline;
  tempMesh: Mesh;

  constructor(public device: GPUDevice) {
    this.textureVisualizer = new TextureVisualizer(device);

    this.cameraBuffer = device.createBuffer({
      label: 'camera uniform buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.lightArrayBuffer = new ArrayBuffer(LIGHT_BUFFER_SIZE);
    this.lightBuffer = device.createBuffer({
      label: 'light storage buffer',
      size: LIGHT_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const lightCount = new Uint32Array(this.lightArrayBuffer, 0, 1);
    lightCount[0] = LIGHT_COUNT;

    const lightColors = [
      [1.0, 0.3, 0.3,  2],
      [0.3, 1.0, 0.3,  2],
      [0.3, 0.3, 1.0,  2],
      [1.0, 1.0, 0.3,  2],
      [0.3, 1.0, 1.0,  2],
      [1.0, 0.3, 1.0,  2],
    ];

    for (let i = 0; i < LIGHT_COUNT; ++i) {
      const lightOffset = 16 + (i * LIGHT_STRUCT_SIZE)
      const posRange = new Float32Array(this.lightArrayBuffer, lightOffset, 4);
      const colorIntensity = new Float32Array(this.lightArrayBuffer, lightOffset + 16, 4);

      const r = (i / LIGHT_COUNT) * Math.PI * 2;
      posRange[0] = Math.sin(r) * 2.5;
      posRange[1] = 0;
      posRange[2] = Math.cos(r) * 2.5;
      posRange[3] = 5;

      colorIntensity.set(lightColors[i % LIGHT_COUNT]);
    }

    this.frameBindGroupLayout = device.createBindGroupLayout({
      label: 'frame bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {} // Camera uniforms
      }, {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' } // Light uniforms
      }]
    });

    this.frameBindGroup = device.createBindGroup({
      label: 'camera bind group',
      layout: this.frameBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraBuffer }
      }, {
        binding: 1,
        resource: { buffer: this.lightBuffer }
      }]
    });

    this.gBufferBindGroupLayout = device.createBindGroupLayout({
      label: 'gBuffer bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      }, {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      }, {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      }, {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'depth' }
      }]
    });

    this.tempMesh = createTempMesh(device);

    this.tempPipeline = this.createDeferredPipeline();

    this.lightingPipeline = this.createLightingPipeline();

    this.lightSpriteRenderer = new LightSpriteRenderer(device, this.frameBindGroupLayout);
  }

  resize(width: number, height: number) {
    if (this.attachmentSize.width == width &&
        this.attachmentSize.height == height) {
      // Textures are already a compatible size!
      return;
    }

    // Recreate all the attachments.
    const size = this.attachmentSize = { width, height };
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

    // TODO: The formats used for these should be stored someone more central rather than repeating
    // them again and again.
    this.rgbaTexture = this.device.createTexture({
      label: 'rgba deferred texture',
      size, usage,
      format: 'rgba8unorm', // Render cost: 8
    });

    this.normalTexture = this.device.createTexture({
      label: 'normal deferred texture',
      size, usage,
      format: 'rgba8unorm', // Render cost: 8
    });

    this.metalRoughTexture = this.device.createTexture({
      label: 'metal/rough deferred texture',
      size, usage,
      format: 'rg8unorm', // Render cost: 2
    });

    this.lightTexture = this.device.createTexture({
      label: 'light accumulation deferred texture',
      size, usage,
      format: 'rgb10a2unorm', // Render cost: 8
    });

    this.depthTexture = this.device.createTexture({
      label: 'depth deferred texture',
      size, usage,
      format: 'depth16unorm', // Render cost: 2
    });

    // Rebuild the render pass inputs
    this.colorAttachments = [{
      view: this.rgbaTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      //clearValue: [0, 0, 1, 1],
    }, {
      view: this.normalTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      //clearValue: [0, 1, 0, 1],
    }, {
      view: this.metalRoughTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      //clearValue: [1, 0, 0, 1],
    }, {
      view: this.lightTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
    }];

    this.lightAttachments = [{
      view: this.colorAttachments[3].view,
      loadOp: 'load',
      storeOp: 'store',
    }];

    this.depthAttachment = {
      view: this.depthTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1,
    };

    this.gBufferBindGroup = this.device.createBindGroup({
      label: 'gBuffer bind group',
      layout: this.gBufferBindGroupLayout,
      entries: [{
        binding: 0,
        resource: this.colorAttachments[0].view,
      }, {
        binding: 1,
        resource: this.colorAttachments[1].view,
      }, {
        binding: 2,
        resource: this.colorAttachments[2].view,
      }, {
        binding: 3,
        resource: this.depthAttachment.view,
      }]
    });
  }

  createDeferredPipeline(): GPURenderPipeline {
    // Things that will come from the model
    const buffers: GPUVertexBufferLayout[] = [{
      arrayStride: 11 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [{
        shaderLocation: 0, // Position
        offset: 0,
        format: 'float32x3'
      }, {
        shaderLocation: 1, // Color
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
        format: 'float32x3'
      },  {
        shaderLocation: 2, // Normal
        offset: 6 * Float32Array.BYTES_PER_ELEMENT,
        format: 'float32x3'
      }, {
        shaderLocation: 3, // Texcoord
        offset: 9 * Float32Array.BYTES_PER_ELEMENT,
        format: 'float32x2'
      }]
    }];
    const topology: GPUPrimitiveTopology = 'triangle-list';

    // Things that will come from the material
    // (This is for opaque surfaces only!)
    const cullMode: GPUCullMode = 'back';

    const module = this.device.createShaderModule({
      label: 'deferred shader module',
      code: gBufferShader
    });

    const pipeline = this.device.createRenderPipeline({
      label: 'deferred render pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.frameBindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
        buffers,
      },
      primitive: {
        topology,
        cullMode,
      },
      depthStencil: {
        format: 'depth16unorm',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: 'rgba8unorm',
        }, {
          format: 'rgba8unorm',
        }, {
          format: 'rg8unorm',
        }, {
          format: 'rgb10a2unorm',
        }],
      },
    });

    return pipeline;
  }

  createLightingPipeline(): GPURenderPipeline {
    const module = this.device.createShaderModule({
      label: 'lighting shader module',
      code: lightingShader
    });

    const pipeline = this.device.createRenderPipeline({
      label: 'lighting render pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.frameBindGroupLayout, this.gBufferBindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: 'rgb10a2unorm',
          blend: {
            color: {
              // Additive rendering
              srcFactor: 'one',
              dstFactor: 'one',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one',
            }
          }
        }],
      },
    });

    return pipeline;
  }

  updateCamera(camera: Camera) {
    // AUGH! BAD!
    const projection = mat4.create();
    mat4.perspectiveZO(projection, Math.PI * 0.5, 1, 0.1, 20);

    const invViewProjection = mat4.create();
    mat4.multiply(invViewProjection, projection, camera.viewMatrix);
    mat4.invert(invViewProjection, invViewProjection);

    const cameraArray = new Float32Array(64);
    cameraArray.set(projection, 0);
    cameraArray.set(camera.viewMatrix, 16);
    cameraArray.set(invViewProjection, 32);
    cameraArray.set(camera.position, 48);

    this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraArray);
  }

  updateLights(t: number) {
    // Need to update any part of the lights?
    for (let i = 0; i < LIGHT_COUNT; ++i) {
      const lightOffset = 16 + (i * LIGHT_STRUCT_SIZE)
      const posRange = new Float32Array(this.lightArrayBuffer, lightOffset, 4);
      //const colorIntensity = new Float32Array(this.lightArrayBuffer, lightOffset + 16, 4);

      const r = (i / LIGHT_COUNT) * Math.PI * 2 + (t/1000);
      posRange[0] = Math.sin(r) * 2.5;
      posRange[1] = Math.sin(t / 1000 + (i / LIGHT_COUNT)) * 1.5;
      posRange[2] = Math.cos(r) * 2.5;
    }

    this.device.queue.writeBuffer(this.lightBuffer, 0, this.lightArrayBuffer);
  }

  render(output: GPUTexture, camera: Camera /*, content: any*/) {
    this.updateCamera(camera);
    this.updateLights(performance.now());

    const encoder = this.device.createCommandEncoder();

    const gBufferPass = encoder.beginRenderPass({
      label: 'gBuffer pass',
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthAttachment
    });

    // Draw stuff
    gBufferPass.setBindGroup(0, this.frameBindGroup);

    gBufferPass.setPipeline(this.tempPipeline);

    const mesh = this.tempMesh;
    for (const buffer of mesh.vertex) {
      gBufferPass.setVertexBuffer(buffer.slot, buffer.buffer, buffer.offset);
    }

    if (mesh.index) {
      gBufferPass.setIndexBuffer(mesh.index.buffer, mesh.index.format);
      gBufferPass.drawIndexed(mesh.drawCount);
    } else {
      gBufferPass.draw(mesh.drawCount);
    }

    gBufferPass.end();

    const lightingPass = encoder.beginRenderPass({
      label: 'deferred lighting pass',
      colorAttachments: this.lightAttachments,
    });

    // Light deferred surfaces

    lightingPass.setPipeline(this.lightingPipeline);
    lightingPass.setBindGroup(0, this.frameBindGroup);
    lightingPass.setBindGroup(1, this.gBufferBindGroup);
    lightingPass.draw(3);

    lightingPass.end();

    const forwardPass = encoder.beginRenderPass({
      label: 'forward pass',
      colorAttachments: this.lightAttachments,
      depthStencilAttachment: {
        view: this.depthAttachment.view,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      }
    });

    // Draw forward stuff?
    forwardPass.setBindGroup(0, this.frameBindGroup);

    this.lightSpriteRenderer.render(forwardPass, LIGHT_COUNT);

    forwardPass.end();

    const outputPass = encoder.beginRenderPass({
      label: 'output pass',

      colorAttachments: [{
        view: output.createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: [0.5, 0, 1, 1],
      }],
    });

    // Tone map
    // Blur
    // Maybe post-process AA?

    // Profit???

    outputPass.end();

    if (this.debugView != DebugViewType.none) {
      const debugPass = encoder.beginRenderPass({
        label: 'debug pass',
        colorAttachments: [{
          view: output.createView(),
          loadOp: 'load',
          storeOp: 'store',
        }]
      });

      switch(this.debugView) {
        case DebugViewType.all:
          debugPass.setViewport(0, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.rgbaTexture);

          debugPass.setViewport(256, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.normalTexture);

          debugPass.setViewport(512, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.metalRoughTexture);

          debugPass.setViewport(768, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.lightTexture);

          debugPass.setViewport(1024, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.depthTexture);
          break;

        case DebugViewType.rgba:
          this.textureVisualizer.render(debugPass, this.rgbaTexture);
          break;

        case DebugViewType.normal:
          this.textureVisualizer.render(debugPass, this.normalTexture);
          break;

        case DebugViewType.metalRough:
          this.textureVisualizer.render(debugPass, this.metalRoughTexture);
          break;

        case DebugViewType.light:
          this.textureVisualizer.render(debugPass, this.lightTexture);
          break;

        case DebugViewType.depth:
          this.textureVisualizer.render(debugPass, this.depthTexture);
          break;
      }

      debugPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }
}