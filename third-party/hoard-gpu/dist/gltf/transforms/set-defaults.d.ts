import { BufferManager } from '../buffer-manager.js';
import { GlTf } from '../gltf.js';
import { ImageManager } from '../image-manager.js';
import { GltfTransform } from './gltf-transform.js';
export declare class SetDefaults extends GltfTransform {
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager): void;
}
