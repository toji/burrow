/// <reference types="dist" />
import { TextureVisualizer } from '../render-utils/texture-visualizer.js';
import { Mat4, Vec3 } from '../../third-party/gl-matrix/dist/src/index.js';
import { LightSpriteRenderer } from '../render-utils/light-sprite.js';
import { RendererBase } from './renderer-base.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
import { SkyboxRenderer } from '../render-utils/skybox.js';
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
export interface Scene {
    meshes: SceneMesh[];
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
    lightingPipeline: GPURenderPipeline;
    lightSpriteRenderer: LightSpriteRenderer;
    skyboxRenderer: SkyboxRenderer;
    defaultMaterial: RenderMaterial;
    pointLights: number;
    animateLights: boolean;
    defaultEnvironment: GPUTexture;
    environmentSampler: GPUSampler;
    constructor(device: GPUDevice);
    updateFrameBindGroup(): void;
    get environment(): GPUTexture;
    set environment(environmentTexture: GPUTexture);
    get exposure(): number;
    set exposure(value: number);
    resize(width: number, height: number): void;
    getDeferredPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial): GPURenderPipeline;
    createLightingPipeline(): GPURenderPipeline;
    createToneMappingPipeline(): GPURenderPipeline;
    updateCamera(camera: Camera): void;
    updateLights(t: number): void;
    render(output: GPUTexture, camera: Camera, scene: Scene): void;
}
export {};
