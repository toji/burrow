import { TextureVisualizer } from './texture-visualizer.js'
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js'
import { mat4, vec3 } from '../node_modules/gl-matrix/esm/index.js';

export enum DebugViewType {
  none = "none",
  all = "all",
  rgba = "rgba",
  normal = "normal",
  metalRough = "metalRough",
  light = "light",
  depth = "depth",
};

interface BufferBinding {
  buffer: GPUBuffer,
  offset: number,
};

interface VertexBufferBinding extends BufferBinding {
  slot: number
};

interface IndexBufferBinding extends BufferBinding {
  format: GPUIndexFormat
};

interface Mesh {
  vertex: VertexBufferBinding[],
  index?: IndexBufferBinding,
  drawCount: number;
}

interface Camera {
  viewMatrix: mat4,
  position: vec3,
}

export class DeferredRenderer {
  attachmentSize: GPUExtent3DDictStrict = { width: 0, height: 0 }

  rgbaTexture: GPUTexture;
  normalTexture: GPUTexture;
  metalRoughTexture: GPUTexture;
  lightTexture: GPUTexture;
  depthTexture: GPUTexture;

  colorAttachments: GPURenderPassColorAttachment[];
  depthAttachment: GPURenderPassDepthStencilAttachment;

  textureVisualizer: TextureVisualizer;

  debugView: DebugViewType = DebugViewType.none;

  cameraBindGroupLayout: GPUBindGroupLayout;
  cameraBindGroup: GPUBindGroup;
  cameraBuffer: GPUBuffer;

  tempPipeline: GPURenderPipeline;
  tempMesh: Mesh;

  constructor(public device: GPUDevice) {
    this.textureVisualizer = new TextureVisualizer(device);

    this.cameraBuffer = device.createBuffer({
      label: 'camera uniform buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.cameraBindGroupLayout = device.createBindGroupLayout({
      label: 'camera bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}
      }]
    });

    this.cameraBindGroup = device.createBindGroup({
      label: 'camera bind group',
      layout: this.cameraBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraBuffer }
      }]
    })

    this.tempPipeline = this.createDeferredPipeline();
    this.tempMesh = this.createTempMesh();
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
      clearValue: [0, 0, 1, 1],
    }, {
      view: this.normalTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: [0, 1, 0, 1],
    }, {
      view: this.metalRoughTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: [1, 0, 0, 1],
    }, {
      view: this.lightTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: [1, 1, 0, 1],
    }];

    this.depthAttachment = {
      view: this.depthTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1,
    };
  }

  createTempMesh(): Mesh {
    const vertexArray = new Float32Array([
       1.0,  1.0,  1.0, // 0
      -1.0,  1.0,  1.0, // 1
       1.0, -1.0,  1.0, // 2
      -1.0, -1.0,  1.0, // 3
       1.0,  1.0, -1.0, // 4
      -1.0,  1.0, -1.0, // 5
       1.0, -1.0, -1.0, // 6
      -1.0, -1.0, -1.0, // 7
    ]);

    const vertexBuffer = this.device.createBuffer({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

    const indexArray = new Uint16Array([
      // PosX (Right)
      0, 2, 4,
      6, 4, 2,

      // NegX (Left)
      5, 3, 1,
      3, 5, 7,
 
      // PosY (Top)
      4, 1, 0,
      1, 4, 5,

      // NegY (Bottom)
      2, 3, 6,
      7, 6, 3,

      // PosZ (Front)
      0, 1, 2,
      3, 2, 1,

      // NegZ (Back)
      6, 5, 4,
      5, 6, 7,
    ]);

    const indexBuffer = this.device.createBuffer({
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(indexBuffer, 0, indexArray);

    return {
      vertex: [{
        slot: 0,
        buffer: vertexBuffer,
        offset: 0
      }],
      index: {
        buffer: indexBuffer,
        offset: 0,
        format: 'uint16'
      },
      drawCount: indexArray.length,
    };
  }

  createDeferredPipeline(): GPURenderPipeline {
    // Things that will come from the model
    const buffers: GPUVertexBufferLayout[] = [{
      arrayStride: 12,
      attributes: [{
        shaderLocation: 0,
        offset: 0,
        format: 'float32x3'
      }]
    }];
    const topology: GPUPrimitiveTopology = 'triangle-list';

    // Things that will come from the material
    // (This is for opaque surfaces only!)
    const cullMode: GPUCullMode = 'none';

    const module = this.device.createShaderModule({
      label: 'deferred shader module',
      code: wgsl`
        struct Camera {
          projection : mat4x4f,
          view : mat4x4f,
          position : vec3f,
          time : f32,
        };
        @group(0) @binding(0) var<uniform> camera : Camera;

        struct VertexInput {
          @location(0) position : vec4f,
        };

        struct VertexOutput {
          @builtin(position) position : vec4f,
          @location(0) normal : vec3f,
          @location(1) texcoord : vec2f,
        };

        @vertex
        fn vertexMain(input : VertexInput) -> VertexOutput {
          var output : VertexOutput;

          output.position = camera.projection * camera.view * input.position;
          output.normal = (camera.view * vec4f(0, 0, 1, 0)).xyz;
          output.texcoord = vec2f(0);

          return output;
        }

        struct FragmentOutput {
          @location(0) albedo : vec4f,
          @location(1) normal : vec4f,
          @location(2) metalRough : vec2f,
          @location(3) light : vec4f,
        };

        @fragment
        fn fragmentMain(input : VertexOutput) -> FragmentOutput {
          var out: FragmentOutput;

          out.albedo = vec4f(1, 0, 1, 1);
          out.normal = vec4f(normalize(input.normal), 1);

          return out;
        }
      `
    });

    const pipeline = this.device.createRenderPipeline({
      label: 'deferred render pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.cameraBindGroupLayout] }),
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

  updateCamera(camera: Camera) {
    // AUGH! BAD!
    const cameraArray = new Float32Array(64);
    mat4.perspectiveZO(cameraArray, Math.PI * 0.5, 1, 0.1, 100);
    cameraArray.set(camera.viewMatrix, 16);
    cameraArray.set(camera.position, 32);

    this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraArray);
  }

  render(output: GPUTexture, camera: Camera /*, content: any*/) {
    this.updateCamera(camera);

    const encoder = this.device.createCommandEncoder();

    const gBufferPass = encoder.beginRenderPass({
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthAttachment
    });

    // Draw stuff
    gBufferPass.setBindGroup(0, this.cameraBindGroup);

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
      colorAttachments: [{
        view: this.colorAttachments[3].view,
        loadOp: 'load',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthAttachment.view,
        depthReadOnly: true,
      }
    });

    // Light stuff

    lightingPass.end();

    const outputPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: output.createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: [0.5, 0, 1, 1],
      }],
      depthStencilAttachment: {
        view: this.depthAttachment.view,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      }
    });

    // Combine RGB/Lighting attachments

    // Draw forward stuff

    // Profit???

    outputPass.end();

    if (this.debugView != DebugViewType.none) {
      const debugPass = encoder.beginRenderPass({
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