import { BufferManager } from '../../buffer-manager.js';
import { GlTf } from '../../gltf.js';
import { ImageManager } from '../../image-manager.js';
import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
export declare class CreateWebGpuTextures extends WebGpuGltfTransform {
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): Promise<any[]>;
}
