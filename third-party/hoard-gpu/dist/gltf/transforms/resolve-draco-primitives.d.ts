import { GltfTransform } from './gltf-transform.js';
import { WorkerPool } from '../../workers/worker-pool.js';
import { GlTf } from '../gltf.js';
import { BufferManager } from '../buffer-manager.js';
import { ImageManager } from '../image-manager.js';
declare class DracoDecoder extends WorkerPool {
    constructor();
    decode(bytes: Uint8Array, attributes: any, indexSize: number): Promise<any>;
}
export declare class ResolveDracoPrimitives extends GltfTransform {
    decoder: DracoDecoder;
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): Promise<void>;
}
export {};
