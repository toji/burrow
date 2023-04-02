import { BufferManager } from './buffer-manager.js';
import { TextureLoaderBase } from '../texture/texture-loader-base.js';
import { JsonValue } from './transforms/gltf-transform.js';
export declare class ImageManager {
    #private;
    baseUrl: string;
    textureLoader: TextureLoaderBase;
    constructor(gltf: any, baseUrl: string, buffers: BufferManager, textureLoader: TextureLoaderBase);
    annotateImages(gltf: any): void;
    setExtras(obj: JsonValue, extras: JsonValue): void;
    getImage(index: number): any;
}
