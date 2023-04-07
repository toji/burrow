/// <reference types="dist" />
import { Renderables } from './deferred-renderer.js';
export declare class RenderLightManager {
    device: GPUDevice;
    lightBuffer: GPUBuffer;
    lightArrayBuffer: ArrayBuffer;
    pointLightCount: number;
    environment: GPUTexture;
    defaultEnvironment: GPUTexture;
    environmentSampler: GPUSampler;
    constructor(device: GPUDevice);
    updateLights(renderables: Renderables): void;
}
