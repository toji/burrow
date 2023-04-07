/// <reference types="dist" />
import { TextureVisualizer } from '../render-utils/texture-visualizer.js';
import { Mat4, Vec3 } from '../../third-party/gl-matrix/dist/src/index.js';
import { LightSpriteRenderer } from '../render-utils/light-sprite.js';
import { RendererBase } from './renderer-base.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
import { SkyboxRenderer } from '../render-utils/skybox.js';
import { TonemapRenderer } from '../render-utils/tonemap.js';
import { RenderSet, RenderSetProvider } from '../render-utils/render-set.js';
import { BloomRenderer } from '../render-utils/bloom.js';
import { DirectionalLight, PointLight } from '../scene/light.js';
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
}
export interface Renderables {
    meshes: SceneMesh[];
    directionalLight?: DirectionalLight;
    pointLights: PointLight[];
}
declare class DeferredRenderSetProvider extends RenderSetProvider {
    renderer: DeferredRenderer;
    pipelineLayout: GPUPipelineLayout;
    constructor(renderer: DeferredRenderer);
    meshFilter(mesh: SceneMesh): boolean;
    createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, key: string): GPURenderPipeline;
}
declare class ForwardRenderSetProvider extends RenderSetProvider {
    renderer: DeferredRenderer;
    pipelineLayout: GPUPipelineLayout;
    constructor(renderer: DeferredRenderer);
    meshFilter(mesh: SceneMesh): boolean;
    createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, key: string): GPURenderPipeline;
}
export declare class DeferredRenderer extends RendererBase {
    attachmentSize: GPUExtent3DDictStrict;
    rgbaTexture: GPUTexture;
    normalTexture: GPUTexture;
    metalRoughTexture: GPUTexture;
    lightTexture: GPUTexture;
    depthTexture: GPUTexture;
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
