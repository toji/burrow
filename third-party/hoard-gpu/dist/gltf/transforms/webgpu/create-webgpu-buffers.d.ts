import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { SetDefaults } from '../set-defaults.js';
import { GlTf } from '../../gltf.js';
import { BufferManager } from '../../buffer-manager.js';
import { ImageManager } from '../../image-manager.js';
export declare class CreateWebGpuBuffers extends WebGpuGltfTransform {
    static Dependencies: (typeof SetDefaults)[];
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager): Promise<any[]>;
}
