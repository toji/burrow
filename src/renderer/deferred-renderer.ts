import { TextureVisualizer } from '../render-utils/texture-visualizer.js'
import { getGBufferShader, lightingShader } from '../shaders/deferred.js';
import { toneMappingShader } from '../shaders/tonemap.js';
import { Mat4, Vec3 } from '../../../gl-matrix/dist/src/index.js';
import { LightSpriteRenderer } from '../render-utils/light-sprite.js';
import { RendererBase } from './renderer-base.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';

export enum DebugViewType {
  none = "none",
  all = "all",
  rgba = "rgba",
  normal = "normal",
  metalRough = "metalRough",
  depth = "depth",
  light = "light",
};

interface Camera {
  viewMatrix: Mat4,
  position: Vec3,
}

const MAX_LIGHTS = 64;
const LIGHT_STRUCT_SIZE = 32;
const LIGHT_BUFFER_SIZE = (MAX_LIGHTS * LIGHT_STRUCT_SIZE) + 16;

const LIGHT_COUNT = 6;

// To prevent per-frame allocations.
const invViewProjection = new Mat4();
const cameraArray = new Float32Array(64);

export interface SceneMesh {
  transform: Mat4;
  geometry: RenderGeometry[];
}

export interface Scene {
  meshes: SceneMesh[];
}

export class DeferredRenderer extends RendererBase {
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

  projection: Mat4;

  gBufferBindGroupLayout: GPUBindGroupLayout;
  gBufferBindGroup: GPUBindGroup;

  toneMappingBindGroupLayout: GPUBindGroupLayout;
  toneMappingBindGroup: GPUBindGroup;
  toneMappingPipeline: GPURenderPipeline;
  toneMappingBuffer: GPUBuffer;

  #exposure: Float32Array = new Float32Array(4);

  lightingPipeline: GPURenderPipeline;

  lightSpriteRenderer: LightSpriteRenderer;

  constructor(device: GPUDevice) {
    super(device);

    this.textureVisualizer = new TextureVisualizer(device);

    this.projection = new Mat4();
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
      [1.0, 0.3, 0.3,  3],
      [0.3, 1.0, 0.3,  2],
      [0.3, 0.3, 1.0,  1],
      [1.0, 1.0, 0.3,  2],
      [0.3, 1.0, 1.0,  2],
      [1.0, 0.3, 1.0,  1],
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

    this.toneMappingBuffer = device.createBuffer({
      label: 'tone mapping uniform buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.exposure = 1.0;

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

    this.toneMappingBindGroupLayout = device.createBindGroupLayout({
      label: 'tone mapping bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' }
      }, {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {}
      }]
    });

    this.lightingPipeline = this.createLightingPipeline();

    this.toneMappingPipeline = this.createToneMappingPipeline();

    this.lightSpriteRenderer = new LightSpriteRenderer(device, this.frameBindGroupLayout);
  }

  get exposure(): number {
    return this.#exposure[0];
  }

  set exposure(value: number) {
    this.#exposure[0] = value;
    this.device.queue.writeBuffer(this.toneMappingBuffer, 0, this.#exposure);
  }

  resize(width: number, height: number) {
    if (this.attachmentSize.width == width &&
        this.attachmentSize.height == height) {
      // Textures are already a compatible size!
      return;
    }

    this.projection.perspectiveZO(Math.PI * 0.5, width/height, 0.1, 20);

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

    this.toneMappingBindGroup = this.device.createBindGroup({
      label: 'tone mapping bind group',
      layout: this.toneMappingBindGroupLayout,
      entries: [{
        binding: 0,
        resource: this.lightAttachments[0].view,
      }, {
        binding: 1,
        resource: { buffer: this.toneMappingBuffer },
      }]
    });
  }

  #deferredPipelineCache: Map<number, GPURenderPipeline> = new Map();
  getDeferredPipeline(layout: Readonly<GeometryLayout>): GPURenderPipeline {
    let pipeline = this.#deferredPipelineCache.get(layout.id);
    if (pipeline) { return pipeline; }

    // Things that will come from the material
    // (This is for opaque surfaces only!)
    const cullMode: GPUCullMode = 'back';

    const module = this.device.createShaderModule({
      label: `deferred shader module (layout ${layout.id})`,
      code: getGBufferShader(layout),
    });

    pipeline = this.device.createRenderPipeline({
      label: `deferred render pipeline (layout ${layout.id})`,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.frameBindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
        buffers: layout.buffers,
      },
      primitive: {
        topology: layout.topology,
        cullMode,
        stripIndexFormat: layout.stripIndexFormat
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

    this.#deferredPipelineCache.set(layout.id, pipeline);
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

  createToneMappingPipeline(): GPURenderPipeline {
    const module = this.device.createShaderModule({
      label: 'tone mapping shader module',
      code: toneMappingShader
    });

    const pipeline = this.device.createRenderPipeline({
      label: 'tone mapping pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.toneMappingBindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: navigator.gpu.getPreferredCanvasFormat(),
        }],
      },
    });

    return pipeline;
  }

  updateCamera(camera: Camera) {
    Mat4.multiply(invViewProjection, this.projection, camera.viewMatrix);
    invViewProjection.invert();

    cameraArray.set(this.projection, 0);
    cameraArray.set(camera.viewMatrix, 16);
    cameraArray.set(invViewProjection, 32);
    cameraArray.set(camera.position, 48);

    this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraArray);
  }

  updateLights(t: number) {
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

  render(output: GPUTexture, camera: Camera, scene: Scene) {
    this.updateCamera(camera);
    this.updateLights(performance.now());

    // Compile renderable list out of scene meshes.
    const pipelineGeometry = new Map<GPURenderPipeline, Set<RenderGeometry>>();
    const geometryInstances = new Map<RenderGeometry, Mat4[]>()

    for (const mesh of scene.meshes) {
      const transform = mesh.transform;
      for (const geometry of mesh.geometry) {
        const pipeline = this.getDeferredPipeline(geometry.layout);
        let geometrySet = pipelineGeometry.get(pipeline);
        if (!geometrySet) {
          geometrySet = new Set<RenderGeometry>();
          pipelineGeometry.set(pipeline, geometrySet);
        }
        geometrySet.add(geometry);

        let instances = geometryInstances.get(geometry);
        if (!instances) {
          instances = [];
          geometryInstances.set(geometry, instances);
        }
        instances.push(transform);
      }
    }

    const encoder = this.device.createCommandEncoder();

    const gBufferPass = encoder.beginRenderPass({
      label: 'gBuffer pass',
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthAttachment
    });

    // Draw stuff
    gBufferPass.setBindGroup(0, this.frameBindGroup);

    for (const [pipeline, geometrySet] of pipelineGeometry.entries()) {
      gBufferPass.setPipeline(pipeline);

      for (const geometry of geometrySet) {
        // Bind the geometry
        for (const buffer of geometry.vertexBuffers) {
          gBufferPass.setVertexBuffer(buffer.slot, buffer.buffer, buffer.offset);
        }

        if (geometry.indexBuffer) {
          gBufferPass.setIndexBuffer(geometry.indexBuffer.buffer, geometry.indexBuffer.indexFormat);
        }

        const instances = geometryInstances.get(geometry);
        for (const instance of instances) {
          // TODO: Bind instance data
          if (geometry.indexBuffer) {
            gBufferPass.drawIndexed(geometry.drawCount);
          } else {
            gBufferPass.draw(geometry.drawCount);
          }
        }
      }
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

    if (this.debugView == DebugViewType.none || this.debugView == DebugViewType.all) {
      const outputPass = encoder.beginRenderPass({
        label: 'output pass',

        colorAttachments: [{
          view: output.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: [0, 0, 0.3, 1],
        }],
      });

      // Tone map
      outputPass.setPipeline(this.toneMappingPipeline);
      outputPass.setBindGroup(0, this.toneMappingBindGroup);
      outputPass.draw(3);

      // Blur
      // Maybe post-process AA?

      // Profit???

      outputPass.end();
    }

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
          // TODO: Prevent viewport errors if window is too small.
          debugPass.setViewport(0, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.rgbaTexture);

          debugPass.setViewport(256, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.normalTexture);

          debugPass.setViewport(512, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.metalRoughTexture);

          debugPass.setViewport(768, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.depthTexture);

          debugPass.setViewport(1024, 0, 256, 256, 0, 1);
          this.textureVisualizer.render(debugPass, this.lightTexture);
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

        case DebugViewType.depth:
          this.textureVisualizer.render(debugPass, this.depthTexture);
          break;

        case DebugViewType.light:
          this.textureVisualizer.render(debugPass, this.lightTexture);
          break;
      }

      debugPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }
}