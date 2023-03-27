import { TextureVisualizer } from './texture-visualizer.js'

export enum DebugViewType {
  none = "none",
  all = "all",
  rgba = "rgba",
  normal = "normal",
  metalRough = "metalRough",
  light = "light",
  depth = "depth",
};

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

  constructor(public device: GPUDevice) {
    this.textureVisualizer = new TextureVisualizer(device);
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
      depthClearValue: 0.0,
    };
  }

  render(output: GPUTexture /*, content: any*/) {
    const encoder = this.device.createCommandEncoder();

    const gBufferPass = encoder.beginRenderPass({
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthAttachment
    });

    // Draw stuff

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