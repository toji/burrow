import { GltfTransform } from './gltf-transform.js';
import { SetDefaults } from './set-defaults.js';
import { GlTf } from '../gltf.js';
import { BufferManager } from '../buffer-manager.js';
import { ImageManager } from '../image-manager.js';
export declare class AABB {
    min: any;
    max: any;
    constructor(aabb?: AABB);
    union(other: AABB): void;
    transform(mat: any): void;
    get center(): any;
    get radius(): number;
}
export declare class ComputeAABB extends GltfTransform {
    static preCache: boolean;
    static Dependencies: (typeof SetDefaults)[];
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any): void;
}
