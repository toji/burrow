/// <reference types="dist" />
import { GltfTransform, JsonValue } from '../gltf-transform.js';
export declare abstract class WebGpuGltfTransform extends GltfTransform {
    static preCache: boolean;
    device: GPUDevice;
    constructor(loaderOptions: any);
    setGpuExtras(obj: JsonValue, gpuExtras: JsonValue): void;
}
