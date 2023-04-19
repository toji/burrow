/// <reference types="dist" />
import { Mat4, Vec3 } from '../../node_modules/gl-matrix/dist/esm/index.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
import { RendererBase } from './renderer-base.js';
import { RenderSet, RenderSetProvider } from './render-utils/render-set.js';
import { BloomRenderer } from './render-utils/bloom.js';
import { LightSpriteRenderer } from './render-utils/light-sprite.js';
import { SkyboxRenderer } from './render-utils/skybox.js';
import { TextureVisualizer } from './render-utils/texture-visualizer.js';
import { TonemapRenderer } from './render-utils/tonemap.js';
import { DirectionalLight, PointLight } from '../scene/light.js';
import { RenderSkin } from '../geometry/skin.js';
import { AnimationTarget } from '../animation/animation.js';
import { ComputeSkinningManager } from './render-utils/compute-skinning.js';
export declare enum DebugViewType {
    none = "none",
    rgba = "rgba",
    ao = "ao",
    normal = "normal",
    metalRough = "metalRough",
    depth = "depth",
    bloom = "bloom",
    light = "light",
    all = "all"
}
interface Camera {
    viewMatrix: Mat4;
    position: Vec3;
}
export interface SceneMesh {
    transform: Mat4;
    geometry: RenderGeometry;
    material?: RenderMaterial;
    skin?: {
        skin: RenderSkin;
        animationTarget: AnimationTarget;
    };
}
export interface Renderables {
    meshes: SceneMesh[];
    directionalLight?: DirectionalLight;
    pointLights: PointLight[];
}
declare class DeferredRenderSetProvider extends RenderSetProvider {
    renderer: DeferredRenderer;
    pipelineLayout: GPUPipelineLayout;
    skinnedPipelineLayout: GPUPipelineLayout;
    constructor(renderer: DeferredRenderer);
    meshFilter(mesh: SceneMesh): boolean;
    createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, skinned: boolean, key: string): GPURenderPipeline;
}
declare class ForwardRenderSetProvider extends RenderSetProvider {
    renderer: DeferredRenderer;
    pipelineLayout: GPUPipelineLayout;
    skinnedPipelineLayout: GPUPipelineLayout;
    constructor(renderer: DeferredRenderer);
    meshFilter(mesh: SceneMesh): boolean;
    createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, skinned: boolean, key: string): GPURenderPipeline;
}
export declare class DeferredRenderer extends RendererBase {
    attachmentSize: GPUExtent3DDictStrict;
    rgbaTexture: GPUTexture;
    normalTexture: GPUTexture;
    metalRoughTexture: GPUTexture;
    lightTexture: GPUTexture;
    depthTexture: GPUTexture;
    depthFormat: GPUTextureFormat;
    colorAttachments: GPURenderPassColorAttachment[];
    lightAttachments: GPURenderPassColorAttachment[];
    depthAttachment: GPURenderPassDepthStencilAttachment;
    textureVisualizer: TextureVisualizer;
    debugView: DebugViewType;
    enableBloom: boolean;
    frameBindGroupLayout: GPUBindGroupLayout;
    frameBindGroup: GPUBindGroup;
    cameraBuffer: GPUBuffer;
    projection: Mat4;
    gBufferBindGroupLayout: GPUBindGroupLayout;
    gBufferBindGroup: GPUBindGroup;
    lightSpriteRenderer: LightSpriteRenderer;
    skyboxRenderer: SkyboxRenderer;
    tonemapRenderer: TonemapRenderer;
    bloomRenderer: BloomRenderer;
    computeSkinner: ComputeSkinningManager;
    defaultMaterial: RenderMaterial;
    deferredRenderSetProvider: DeferredRenderSetProvider;
    forwardRenderSetProvider: ForwardRenderSetProvider;
    constructor(device: GPUDevice);
    updateFrameBindGroup(): void;
    get environment(): GPUTexture;
    set environment(environmentTexture: GPUTexture);
    resize(width: number, height: number): void;
    lightingPipelines: Map<number, GPURenderPipeline>;
    getLightingPipeline(): GPURenderPipeline;
    updateCamera(camera: Camera): void;
    drawRenderSet(renderPass: GPURenderPassEncoder, renderSet: RenderSet): void;
    render(output: GPUTexture, camera: Camera, renderables: Renderables): void;
}
export {};
