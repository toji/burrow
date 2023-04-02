/// <reference types="dist" />
import { GltfLoader } from './gltf-loader.js';
import { GltfTransform } from './transforms/gltf-transform.js';
export declare class WebGpuGltfLoader extends GltfLoader {
    constructor(device: GPUDevice, transforms?: typeof GltfTransform[], loaderOptions?: any);
}
