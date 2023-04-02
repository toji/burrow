export class ResolveTextureWebGpuResources extends WebGpuGltfTransform {
    static Dependencies: (typeof CreateWebGpuTextures | typeof CreateWebGpuSamplers)[];
    transform(gltf: any, buffers: any, images: any, options: any, transformResults: any): Promise<void>;
}
import { WebGpuGltfTransform } from "./webgpu-gltf-transform.js";
import { CreateWebGpuTextures } from "./create-webgpu-textures.js";
import { CreateWebGpuSamplers } from "./create-webgpu-samplers.js";
