import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { CreateWebGpuTextures } from './create-webgpu-textures.js';
import { CreateWebGpuSamplers } from './create-webgpu-samplers.js';
import { GlTf } from '../../gltf.js';
import { BufferManager } from '../../buffer-manager.js';
import { ImageManager } from '../../image-manager.js';
export declare class ResolveTextureWebGpuResources extends WebGpuGltfTransform {
    static Dependencies: (typeof CreateWebGpuTextures | typeof CreateWebGpuSamplers)[];
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): Promise<void>;
}
