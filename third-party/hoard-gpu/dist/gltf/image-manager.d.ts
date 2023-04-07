import { BufferManager } from './buffer-manager.js';
import { TextureLoaderBase } from '../texture/texture-loader-base.js';
import { GlTf } from './gltf.js';
export declare class ImageManager {
    #private;
    baseUrl: string;
    textureLoader: TextureLoaderBase;
    constructor(gltf: any, baseUrl: string, buffers: BufferManager, textureLoader: TextureLoaderBase);
    annotateImages(gltf: GlTf): void;
    setExtras(obj: any, extras: any): void;
    getImage(index: number): any;
}
