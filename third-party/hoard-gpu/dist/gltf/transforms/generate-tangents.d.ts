import { BufferManager } from '../buffer-manager.js';
import { GlTf } from '../gltf.js';
import { ImageManager } from '../image-manager.js';
import { GltfTransform } from './gltf-transform.js';
import { SetDefaults } from './set-defaults.js';
export declare class GenerateTangents extends GltfTransform {
    Dependencies: (typeof SetDefaults)[];
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): Promise<any[]>;
}
