import { Mat4 } from '../../node_modules/gl-matrix/dist/esm/index.js';
import { RendererBase } from './renderer-base.js';
import { RenderSetProvider } from './render-utils/render-set.js';
import { BloomRenderer } from './render-utils/bloom.js';
import { LightSpriteRenderer } from './render-utils/light-sprite.js';
import { SkyboxRenderer } from './render-utils/skybox.js';
import { TextureVisualizer } from './render-utils/texture-visualizer.js';
import { TonemapRenderer } from './render-utils/tonemap.js';
import { getGBufferShader, getLightingShader } from './shaders/deferred.js';
import { getForwardShader } from './shaders/forward.js';
import { ComputeSkinningManager } from './render-utils/compute-skinning.js';
import { SsaoRenderer } from './render-utils/ssao.js';
import { FullscreenQuadVertexState } from './render-utils/fullscreen-quad.js';
export var DebugViewType;
(function (DebugViewType) {
    DebugViewType["none"] = "none";
    DebugViewType["rgba"] = "rgba";
    DebugViewType["ao"] = "ao";
    DebugViewType["normal"] = "normal";
    DebugViewType["metalRough"] = "metalRough";
    DebugViewType["depth"] = "depth";
    DebugViewType["bloom"] = "bloom";
    DebugViewType["light"] = "light";
    DebugViewType["all"] = "all";
})(DebugViewType || (DebugViewType = {}));
;
// To prevent per-frame allocations.
const invViewProjection = new Mat4();
const invProjection = new Mat4();
const cameraArray = new Float32Array(80);
const IDENTITY_MATRIX = new Mat4();
class DeferredRenderSetProvider extends RenderSetProvider {
    renderer;
    pipelineLayout;
    skinnedPipelineLayout;
    constructor(renderer) {
        super(renderer.device, renderer.defaultMaterial);
        this.renderer = renderer;
        this.pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [
                renderer.frameBindGroupLayout,
                this.instanceBindGroupLayout,
                renderer.renderMaterialManager.materialBindGroupLayout,
            ] });
        this.skinnedPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [
                renderer.frameBindGroupLayout,
                this.instanceBindGroupLayout,
                renderer.renderMaterialManager.materialBindGroupLayout,
                renderer.skinBindGroupLayout,
            ] });
    }
    meshFilter(mesh) {
        return mesh.material?.transparent !== true && mesh.material?.unlit !== true;
    }
    createPipeline(layout, material, skinned, key) {
        // Things that will come from the material
        // (This is for opaque surfaces only!)
        const cullMode = material.doubleSided ? 'none' : 'back';
        const module = this.device.createShaderModule({
            label: `deferred shader module (key ${key})`,
            code: getGBufferShader(layout, material, skinned),
        });
        return this.device.createRenderPipeline({
            label: `deferred render pipeline (key ${key})`,
            layout: skinned ? this.skinnedPipelineLayout : this.pipelineLayout,
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
                format: this.renderer.depthFormat,
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
    }
}
class ForwardRenderSetProvider extends RenderSetProvider {
    renderer;
    pipelineLayout;
    skinnedPipelineLayout;
    constructor(renderer) {
        super(renderer.device, renderer.defaultMaterial);
        this.renderer = renderer;
        this.pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [
                renderer.frameBindGroupLayout,
                this.instanceBindGroupLayout,
                renderer.renderMaterialManager.materialBindGroupLayout,
            ] });
        this.skinnedPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [
                renderer.frameBindGroupLayout,
                this.instanceBindGroupLayout,
                renderer.renderMaterialManager.materialBindGroupLayout,
                renderer.skinBindGroupLayout,
            ] });
    }
    meshFilter(mesh) {
        return mesh.material?.transparent === true || mesh.material?.unlit === true;
    }
    createPipeline(layout, material, skinned, key) {
        // Things that will come from the material
        const cullMode = material.doubleSided ? 'none' : 'back';
        const module = this.device.createShaderModule({
            label: `forward shader module (key ${key})`,
            code: getForwardShader(layout, material, skinned),
        });
        let depthCompare = 'less';
        let blend = undefined;
        if (material.transparent) {
            depthCompare = 'less-equal';
            blend = {
                color: {
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                },
                alpha: {
                    srcFactor: 'one',
                    dstFactor: 'zero',
                }
            };
        }
        return this.device.createRenderPipeline({
            label: `forward render pipeline (key ${key})`,
            layout: skinned ? this.skinnedPipelineLayout : this.pipelineLayout,
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
                format: this.renderer.depthFormat,
                depthWriteEnabled: true,
                depthCompare,
            },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{
                        format: 'rgb10a2unorm',
                        blend
                    }],
            },
        });
    }
}
export class DeferredRenderer extends RendererBase {
    attachmentSize = { width: 0, height: 0 };
    rgbaTexture;
    normalTexture;
    metalRoughTexture;
    lightTexture;
    depthTexture;
    depthFormat = 'depth24plus';
    colorAttachments;
    lightAttachments;
    depthAttachment;
    textureVisualizer;
    debugView = DebugViewType.none;
    enableBloom = false; // This eats up a lot of fill rate, and I'm still not satisfied with the effect, so false by default.
    enableSsao = false;
    frameBindGroupLayout;
    frameBindGroup;
    cameraBuffer;
    projection;
    zNear = 0.1;
    zFar = 50.0;
    gBufferBindGroupLayout;
    gBufferBindGroup;
    lightSpriteRenderer;
    skyboxRenderer;
    tonemapRenderer;
    bloomRenderer;
    ssaoRenderer;
    computeSkinner;
    defaultMaterial;
    deferredRenderSetProvider;
    forwardRenderSetProvider;
    constructor(device) {
        super(device);
        this.textureVisualizer = new TextureVisualizer(device);
        this.projection = new Mat4();
        this.cameraBuffer = device.createBuffer({
            label: 'camera uniform buffer',
            size: cameraArray.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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
        // Prime the lighting pipeline
        this.getLightingPipeline();
        this.lightSpriteRenderer = new LightSpriteRenderer(device, this.frameBindGroupLayout, this.depthFormat);
        this.skyboxRenderer = new SkyboxRenderer(device, this.frameBindGroupLayout, this.depthFormat);
        this.tonemapRenderer = new TonemapRenderer(device, navigator.gpu.getPreferredCanvasFormat());
        this.bloomRenderer = new BloomRenderer(device, 'rgb10a2unorm');
        this.ssaoRenderer = new SsaoRenderer(device, this.frameBindGroupLayout, 'rgba8unorm');
        this.computeSkinner = new ComputeSkinningManager(this);
        this.defaultMaterial = this.createMaterial({
            label: 'Default Material',
            baseColorFactor: [0, 1, 0, 1],
        });
        this.deferredRenderSetProvider = new DeferredRenderSetProvider(this);
        this.forwardRenderSetProvider = new ForwardRenderSetProvider(this);
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
                    resource: { buffer: this.renderLightManager.lightBuffer }
                }, {
                    binding: 2,
                    resource: this.renderLightManager.environmentSampler,
                }, {
                    binding: 3,
                    resource: (this.renderLightManager.environment || this.renderLightManager.defaultEnvironment).createView({
                        dimension: 'cube'
                    })
                }]
        });
    }
    get environment() {
        return this.renderLightManager.environment;
    }
    set environment(environmentTexture) {
        // TODO: Validate that it's a cube map?
        this.renderLightManager.environment = environmentTexture;
        this.updateFrameBindGroup();
    }
    resize(width, height) {
        if (this.attachmentSize.width == width &&
            this.attachmentSize.height == height) {
            // Textures are already a compatible size!
            return;
        }
        this.projection.perspectiveZO(Math.PI * 0.5, width / height, this.zNear, this.zFar);
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
            format: this.depthFormat, // Render cost: 2 - 4
        });
        // Rebuild the render pass inputs
        this.colorAttachments = [{
                view: this.rgbaTexture.createView(),
                loadOp: 'clear',
                storeOp: 'store',
            }, {
                view: this.normalTexture.createView(),
                loadOp: 'clear',
                storeOp: 'store',
            }, {
                view: this.metalRoughTexture.createView(),
                loadOp: 'clear',
                storeOp: 'store',
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
        this.bloomRenderer.updateInputTexture(this.lightTexture);
        this.tonemapRenderer.updateInputTexture(this.lightTexture);
        this.tonemapRenderer.updateBloomTexture(this.bloomRenderer.intermediateTexture);
    }
    lightingPipelines = new Map();
    getLightingPipeline() {
        const key = (this.environment ? 0x01 : 0) |
            (this.renderLightManager.pointLightCount > 0 ? 0x02 : 0) |
            (this.renderLightManager.directionalIntensity > 0 ? 0x04 : 0); // Directional Lights
        let pipeline = this.lightingPipelines.get(key);
        if (!pipeline) {
            const module = this.device.createShaderModule({
                label: `lighting shader module ${key}`,
                code: getLightingShader(!!this.environment, this.renderLightManager.pointLightCount > 0, this.renderLightManager.directionalIntensity > 0),
            });
            pipeline = this.device.createRenderPipeline({
                label: `lighting render pipeline ${key}`,
                layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.frameBindGroupLayout, this.gBufferBindGroupLayout] }),
                vertex: FullscreenQuadVertexState(this.device),
                depthStencil: {
                    depthCompare: 'always',
                    depthWriteEnabled: false,
                    format: this.depthFormat,
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
            this.lightingPipelines.set(key, pipeline);
        }
        return pipeline;
    }
    updateCamera(camera) {
        Mat4.multiply(invViewProjection, this.projection, camera.viewMatrix);
        invViewProjection.invert();
        Mat4.invert(invProjection, this.projection);
        cameraArray.set(this.projection, 0);
        cameraArray.set(camera.viewMatrix, 16);
        cameraArray.set(invViewProjection, 32);
        cameraArray.set(invProjection, 48);
        cameraArray.set(camera.position, 64);
        cameraArray.set([performance.now(), this.zNear, this.zFar], 67);
        this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraArray);
    }
    drawRenderSet(renderPass, renderSet) {
        if (!renderSet.totalInstanceCount) {
            return;
        } // Nothing to render
        renderPass.setBindGroup(1, renderSet.instanceBindGroup);
        for (const [pipeline, materialGeometries] of renderSet.pipelineMaterials.entries()) {
            renderPass.setPipeline(pipeline);
            for (const [material, geometryInstances] of materialGeometries.entries()) {
                renderPass.setBindGroup(2, material.bindGroup);
                for (const [geometry, instances] of geometryInstances.entries()) {
                    // Bind the geometry
                    for (const buffer of geometry.vertexBuffers) {
                        renderPass.setVertexBuffer(buffer.slot, buffer.buffer, buffer.offset);
                    }
                    if (geometry.indexBuffer) {
                        renderPass.setIndexBuffer(geometry.indexBuffer.buffer, geometry.indexBuffer.indexFormat, geometry.indexBuffer.offset);
                    }
                    if (instances.skin) {
                        renderPass.setBindGroup(3, instances.skin.bindGroup);
                    }
                    if (geometry.indexBuffer) {
                        renderPass.drawIndexed(geometry.drawCount, instances.instanceCount, 0, 0, instances.firstInstance);
                    }
                    else {
                        renderPass.draw(geometry.drawCount, instances.instanceCount, 0, instances.firstInstance);
                    }
                }
            }
        }
    }
    render(output, camera, renderables) {
        this.updateCamera(camera);
        this.renderLightManager.updateLights(renderables);
        const skinnedMeshes = [];
        for (const mesh of renderables.meshes) {
            // TODO: A single skin COULD be used for multiple meshes, which would make this redundant.
            if (mesh.skin) {
                skinnedMeshes.push(mesh);
                mesh.skin.skin.updateJoints(mesh.skin.animationTarget);
            }
        }
        if (skinnedMeshes) {
            const encoder = this.device.createCommandEncoder();
            const computePass = encoder.beginComputePass({});
            for (const mesh of skinnedMeshes) {
                mesh.transform = IDENTITY_MATRIX;
                mesh.geometry = this.computeSkinner.skinGeometry(computePass, mesh.geometry, mesh.skin.skin);
                mesh.skin = null;
            }
            computePass.end();
            this.device.queue.submit([encoder.finish()]);
        }
        // Compile renderable list out of scene meshes.
        const deferredRenderSet = this.deferredRenderSetProvider.getRenderSet(renderables.meshes);
        const forwardRenderSet = this.forwardRenderSetProvider.getRenderSet(renderables.meshes);
        const encoder = this.device.createCommandEncoder();
        const gBufferPass = encoder.beginRenderPass({
            label: 'gBuffer pass',
            colorAttachments: this.colorAttachments,
            depthStencilAttachment: this.depthAttachment
        });
        // Draw stuff
        gBufferPass.setBindGroup(0, this.frameBindGroup);
        this.drawRenderSet(gBufferPass, deferredRenderSet);
        gBufferPass.end();
        // SSAO pass
        if (this.enableSsao) {
            this.ssaoRenderer.render(encoder, this.frameBindGroup, this.depthAttachment.view, this.colorAttachments[1].view, this.rgbaTexture);
        }
        // Deferred lighting pass
        const lightingPass = encoder.beginRenderPass({
            label: 'deferred lighting pass',
            colorAttachments: this.lightAttachments,
            depthStencilAttachment: {
                view: this.depthAttachment.view,
                depthReadOnly: true,
            }
        });
        // Light deferred surfaces
        lightingPass.setPipeline(this.getLightingPipeline());
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
        this.drawRenderSet(forwardPass, forwardRenderSet);
        if (this.environment) {
            this.skyboxRenderer.render(forwardPass);
        }
        this.lightSpriteRenderer.render(forwardPass, this.renderLightManager.pointLightCount);
        forwardPass.end();
        if (this.enableBloom) {
            this.bloomRenderer.render(encoder);
        }
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
            this.tonemapRenderer.render(outputPass, this.enableBloom);
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
            switch (this.debugView) {
                case DebugViewType.all: {
                    let offsetX = 0;
                    let offsetY = 0;
                    let previewWidth = 256;
                    const aspect = output.height / output.width;
                    const addPreview = (texture, alphaOnly = false) => {
                        if (offsetY + previewWidth * aspect > output.height) {
                            return;
                        }
                        debugPass.setViewport(offsetX, offsetY, previewWidth, previewWidth * aspect, 0, 1);
                        this.textureVisualizer.render(debugPass, texture, 0, 0, 0, 0, undefined, alphaOnly);
                        offsetX += previewWidth;
                        if (offsetX + previewWidth >= output.width) {
                            offsetY += previewWidth * aspect;
                            offsetX = 0;
                        }
                    };
                    // TODO: Prevent viewport errors if window is too small.
                    addPreview(this.rgbaTexture);
                    addPreview(this.rgbaTexture, true);
                    addPreview(this.normalTexture);
                    addPreview(this.metalRoughTexture);
                    addPreview(this.depthTexture);
                    if (this.enableBloom) {
                        addPreview(this.bloomRenderer.intermediateTexture);
                    }
                    addPreview(this.lightTexture);
                    break;
                }
                case DebugViewType.rgba:
                    this.textureVisualizer.render(debugPass, this.rgbaTexture);
                    break;
                case DebugViewType.ao:
                    this.textureVisualizer.render(debugPass, this.rgbaTexture, 0, 0, 0, 0, undefined, true);
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
                case DebugViewType.bloom:
                    if (this.enableBloom) {
                        this.textureVisualizer.render(debugPass, this.bloomRenderer.intermediateTexture);
                    }
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
//# sourceMappingURL=deferred-renderer.js.map