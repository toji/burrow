/// <reference types="dist" />
import { GltfTransform } from '../gltf-transform.js';
export declare abstract class WebGpuGltfTransform extends GltfTransform {
    static preCache: boolean;
    device: GPUDevice;
    constructor(loaderOptions: any);
    setGpuExtras(obj: any, gpuExtras: any): void;
}
