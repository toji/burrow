import { GlTf } from '../../gltf.js';
import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
export declare class CreateWebGpuSamplers extends WebGpuGltfTransform {
    samplerCache: Map<any, any>;
    transform(gltf: GlTf): void;
}
