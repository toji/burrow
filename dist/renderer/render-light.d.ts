/// <reference types="dist" />
import { Scene } from "./deferred-renderer";
export declare class RenderLightManager {
    device: GPUDevice;
    lightBuffer: GPUBuffer;
    lightArrayBuffer: ArrayBuffer;
    pointLightCount: number;
    environment: GPUTexture;
    defaultEnvironment: GPUTexture;
    environmentSampler: GPUSampler;
    constructor(device: GPUDevice);
    updateLights(scene: Scene): void;
}
