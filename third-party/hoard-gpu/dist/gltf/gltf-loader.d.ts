import { TextureLoaderBase } from '../texture/texture-loader-base.js';
import { GltfTransform } from './transforms/gltf-transform.js';
import { GlTf } from './gltf.js';
export declare class GltfLoader {
    supportedFormatList: any[];
    textureLoader: TextureLoaderBase;
    preCacheTransforms: GltfTransform[];
    postCacheTransforms: GltfTransform[];
    constructor(textureLoader: TextureLoaderBase, transforms?: (typeof GltfTransform)[], loaderOptions?: any);
    loadFromUrl(url: string, userOptions?: any): Promise<GlTf>;
    loadFromBinary(arrayBuffer: ArrayBuffer, options?: any): Promise<GlTf>;
    loadFromJson(gltf: GlTf, options?: any): Promise<GlTf>;
    clearCache(): void;
}
