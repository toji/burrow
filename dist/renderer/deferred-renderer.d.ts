/// <reference types="dist" />
import { TextureVisualizer } from '../render-utils/texture-visualizer.js';
import { Mat4, Vec3, Vec3Like, Vec4Like } from '../../third-party/gl-matrix/dist/src/index.js';
import { LightSpriteRenderer } from '../render-utils/light-sprite.js';
import { RendererBase } from './renderer-base.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
import { SkyboxRenderer } from '../render-utils/skybox.js';
import { TonemapRenderer } from '../render-utils/tonemap.js';
export declare enum DebugViewType {
    none = "none",
    rgba = "rgba",
    ao = "ao",
    normal = "normal",
    metalRough = "metalRough",
    depth = "depth",
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
export interface DirectionalLight {
    direction: Vec3Like;
    color?: Vec4Like;
    intensity?: number;
}
export interface PointLight {
    position: Vec3Like;
    range?: number;
    color?: Vec3Like;
    intensity?: number;
}
export interface Scene {
    meshes: SceneMesh[];
    directionalLight?: DirectionalLight;
    pointLights?: PointLight[];
}
export declare class DeferredRenderer extends RendererBase {
    #private;
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
    frameBindGroupLayout: GPUBindGroupLayout;
    frameBindGroup: GPUBindGroup;
    cameraBuffer: GPUBuffer;
    projection: Mat4;
    instanceBindGroupLayout: GPUBindGroupLayout;
    instanceBindGroup: GPUBindGroup;
    instanceBuffer: GPUBuffer;
    instanceArray: Float32Array;
    gBufferBindGroupLayout: GPUBindGroupLayout;
    gBufferBindGroup: GPUBindGroup;
    lightSpriteRenderer: LightSpriteRenderer;
    skyboxRenderer: SkyboxRenderer;
    tonemapRenderer: TonemapRenderer;
    defaultMaterial: RenderMaterial;
    constructor(device: GPUDevice);
    updateFrameBindGroup(): void;
    get environment(): GPUTexture;
    set environment(environmentTexture: GPUTexture);
    resize(width: number, height: number): void;
    getDeferredPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial): GPURenderPipeline;
    lightingPipelines: Map<number, GPURenderPipeline>;
    getLightingPipeline(): GPURenderPipeline;
    updateCamera(camera: Camera): void;
    render(output: GPUTexture, camera: Camera, scene: Scene): void;
}
export {};
