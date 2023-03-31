import { TextureVisualizer } from '../render-utils/texture-visualizer.js'
import { getGBufferShader, lightingShader } from '../shaders/deferred.js';
import { toneMappingShader } from '../shaders/tonemap.js';
import { Mat4, Vec3 } from '../../../gl-matrix/dist/src/index.js';
import { LightSpriteRenderer } from '../render-utils/light-sprite.js';
import { RendererBase } from './renderer-base.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
import { SkyboxRenderer } from '../render-utils/skybox.js';

export enum DebugViewType {
  none = "none",
  rgba = "rgba",
  normal = "normal",
  metalRough = "metalRough",
  depth = "depth",
  light = "light",
  all = "all",
};

interface Camera {
  viewMatrix: Mat4,
  position: Vec3,
}

const MAX_LIGHTS = 64;
const LIGHT_STRUCT_SIZE = 32;
const LIGHT_BUFFER_SIZE = (MAX_LIGHTS * LIGHT_STRUCT_SIZE) + 16;

const LIGHT_COUNT = 6;

const MAX_INSTANCES = 1024;
const INSTANCE_SIZE = 64;

// To prevent per-frame allocations.
const invViewProjection = new Mat4();
const cameraArray = new Float32Array(64);

export interface SceneMesh {
  transform: Mat4;
  geometry: RenderGeometry,
  material?: RenderMaterial,
}

export interface Scene {
  meshes: SceneMesh[];
}

interface GeometryInstances {
  firstInstance: number,
  instanceCount: number,
  transforms: Mat4[],
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

  instanceBindGroupLayout: GPUBindGroupLayout;
  instanceBindGroup: GPUBindGroup;
  instanceBuffer: GPUBuffer;
  instanceArray: Float32Array;

  gBufferBindGroupLayout: GPUBindGroupLayout;
  gBufferBindGroup: GPUBindGroup;

  toneMappingBindGroupLayout: GPUBindGroupLayout;
  toneMappingBindGroup: GPUBindGroup;
  toneMappingPipeline: GPURenderPipeline;
  toneMappingBuffer: GPUBuffer;

  #exposure: Float32Array = new Float32Array(4);

  lightingPipeline: GPURenderPipeline;

  lightSpriteRenderer: LightSpriteRenderer;
  skyboxRenderer: SkyboxRenderer;

  defaultMaterial: RenderMaterial;
  animateLights: boolean = true;

  #environment: GPUTexture; // IBL Map
  defaultEnvironment: GPUTexture;
  environmentSampler: GPUSampler;

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

    this.instanceArray = new Float32Array(MAX_INSTANCES * INSTANCE_SIZE / Float32Array.BYTES_PER_ELEMENT);
    this.instanceBuffer = device.createBuffer({
      label: 'instance transform storage buffer',
      size: MAX_INSTANCES * INSTANCE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const lightCount = new Uint32Array(this.lightArrayBuffer, 0, 1);
    lightCount[0] = LIGHT_COUNT;

    const lightColors = [
      [1.0, 1.0, 1.0,  3],
      [1.0, 0.3, 0.3,  1],
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

    this.environmentSampler = device.createSampler({
      label: 'environment sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
    });

    // A simple 1x1 black environment map
    this.defaultEnvironment = device.createTexture({
      label: 'default environment map',
      size: [1, 1, 6],
      usage: GPUTextureUsage.TEXTURE_BINDING,
      format: 'rg11b10ufloat',
    });

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
      }, {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Environment sampler
      }, {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { viewDimension: 'cube' } // Environment map
      }]
    });

    this.updateFrameBindGroup();

    this.instanceBindGroupLayout = device.createBindGroupLayout({
      label: 'instance bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' }
      }]
    });

    this.instanceBindGroup = device.createBindGroup({
      label: 'instance bind group',
      layout: this.instanceBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.instanceBuffer }
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
    this.skyboxRenderer = new SkyboxRenderer(device, this.frameBindGroupLayout);

    this.defaultMaterial = this.createMaterial({
      label: 'Default Material',
      baseColorFactor: [0, 1, 0, 1],
    });
  }

  updateFrameBindGroup() {
    this.frameBindGroup = this.device.createBindGroup({
      label: 'frame bind group',
      layout: this.frameBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraBuffer }
      }, {
        binding: 1,
        resource: { buffer: this.lightBuffer }
      }, {
        binding: 2,
        resource: this.environmentSampler,
      }, {
        binding: 3,
        resource: (this.#environment || this.defaultEnvironment).createView({
          dimension: 'cube'
        })
      }]
    });
  }

  get environment(): GPUTexture {
    return this.#environment;
  }

  set environment(environmentTexture: GPUTexture) {
    // TODO: Validate that it's a cube map?
    this.#environment = environmentTexture;
    this.updateFrameBindGroup();
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

  #deferredPipelineCache: Map<string, GPURenderPipeline> = new Map();
  getDeferredPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial): GPURenderPipeline {
    let pipelineKey = `${layout.id};${material.key}`;

    let pipeline = this.#deferredPipelineCache.get(pipelineKey);
    if (pipeline) { return pipeline; }

    // Things that will come from the material
    // (This is for opaque surfaces only!)
    const cullMode: GPUCullMode = material.doubleSided ? 'none' : 'back';

    const module = this.device.createShaderModule({
      label: `deferred shader module (key ${pipelineKey})`,
      code: getGBufferShader(layout, material),
    });

    pipeline = this.device.createRenderPipeline({
      label: `deferred render pipeline (key ${pipelineKey})`,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [
        this.frameBindGroupLayout,
        this.instanceBindGroupLayout,
        this.renderMaterialManager.materialBindGroupLayout,
      ] }),
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

    this.#deferredPipelineCache.set(pipelineKey, pipeline);
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
      depthStencil: {
        depthCompare: 'always',
        depthWriteEnabled: false,
        format: 'depth16unorm',
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
    if (this.animateLights) {
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
  }

  render(output: GPUTexture, camera: Camera, scene: Scene) {
    this.updateCamera(camera);
    this.updateLights(performance.now());

    // Compile renderable list out of scene meshes.
    const pipelineMaterials = new Map<GPURenderPipeline, Map<RenderMaterial, Map<RenderGeometry, GeometryInstances>>>();

    const instanceList: GeometryInstances[] = [];

    for (const mesh of scene.meshes) {
      const transform = mesh.transform;
      const material = mesh.material ?? this.defaultMaterial;
      const geometry = mesh.geometry;

      const pipeline = this.getDeferredPipeline(geometry.layout, material);

      let materialGeometries = pipelineMaterials.get(pipeline);
      if (!materialGeometries) {
        materialGeometries = new Map();
        pipelineMaterials.set(pipeline, materialGeometries);
      }

      let geometryInstances = materialGeometries.get(material);
      if (!geometryInstances) {
        geometryInstances = new Map();
        materialGeometries.set(material, geometryInstances);
      }

      let instances = geometryInstances.get(geometry);
      if (!instances) {
        instances = {
          firstInstance: -1,
          instanceCount: -1,
          transforms: []
        };
        geometryInstances.set(geometry, instances);
        instanceList.push(instances);
      }
      instances.transforms.push(transform);
    }

    // Update the instance buffer
    let instanceOffset = 0;
    for (const instances of instanceList) {
      instances.firstInstance = instanceOffset;
      instances.instanceCount = instances.transforms.length;
      for (const transform of instances.transforms) {
        this.instanceArray.set(transform, instanceOffset * 16);
        instanceOffset++;
      }
    }
    this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceArray);

    const encoder = this.device.createCommandEncoder();

    const gBufferPass = encoder.beginRenderPass({
      label: 'gBuffer pass',
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthAttachment
    });

    // Draw stuff
    gBufferPass.setBindGroup(0, this.frameBindGroup);
    gBufferPass.setBindGroup(1, this.instanceBindGroup);

    for (const [pipeline, materialGeometries] of pipelineMaterials.entries()) {
      gBufferPass.setPipeline(pipeline);

      for (const [material, geometryInstances] of materialGeometries.entries()) {
        gBufferPass.setBindGroup(2, material.bindGroup);

        for (const [geometry, instances] of geometryInstances.entries()) {
          // Bind the geometry
          for (const buffer of geometry.vertexBuffers) {
            gBufferPass.setVertexBuffer(buffer.slot, buffer.buffer, buffer.offset);
          }

          if (geometry.indexBuffer) {
            gBufferPass.setIndexBuffer(geometry.indexBuffer.buffer, geometry.indexBuffer.indexFormat, geometry.indexBuffer.offset);
          }

          if (geometry.indexBuffer) {
            gBufferPass.drawIndexed(geometry.drawCount, instances.instanceCount, 0, 0, instances.firstInstance);
          } else {
            gBufferPass.draw(geometry.drawCount, instances.instanceCount, 0, instances.firstInstance);
          }

          /*for (const instance of instances) {
            // TODO: Bind instance data
            if (geometry.indexBuffer) {
              gBufferPass.drawIndexed(geometry.drawCount);
            } else {
              gBufferPass.draw(geometry.drawCount);
            }
          }*/
        }
      }
    }

    gBufferPass.end();

    const lightingPass = encoder.beginRenderPass({
      label: 'deferred lighting pass',
      colorAttachments: this.lightAttachments,
      depthStencilAttachment: {
        view: this.depthAttachment.view,
        depthReadOnly: true,
      }
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

    if (this.environment) {
      this.skyboxRenderer.render(forwardPass);
    }

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
        case DebugViewType.all: {
          let offsetX = 0;
          let offsetY = 0;
          let previewWidth = 256;
          const aspect = output.height / output.width;

          const addPreview = (texture: GPUTexture) => {
            if (offsetY + previewWidth * aspect > output.height) {
              return;
            }

            debugPass.setViewport(offsetX, offsetY, previewWidth, previewWidth * aspect, 0, 1);
            this.textureVisualizer.render(debugPass, texture);

            offsetX += previewWidth;
            if (offsetX + previewWidth >= output.width) {
              offsetY += previewWidth * aspect;
              offsetX = 0;
            }
          }

          // TODO: Prevent viewport errors if window is too small.
          addPreview(this.rgbaTexture);
          addPreview(this.normalTexture);
          addPreview(this.metalRoughTexture);
          addPreview(this.depthTexture);
          addPreview(this.lightTexture);

          break;
        }
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