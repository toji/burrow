import { BufferManager } from '../buffer-manager.js';
import { GlTf } from '../gltf.js';
import { ImageManager } from '../image-manager.js';
export declare abstract class GltfTransform {
    static Dependencies: any[];
    static preCache: boolean;
    constructor(loaderOptions: any);
    abstract transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): any;
    setExtras(obj: any, extras: any): void;
}
