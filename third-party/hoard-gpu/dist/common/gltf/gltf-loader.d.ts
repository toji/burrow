import { TextureLoaderBase } from '../texture/texture-loader-base.js';
import { GltfTransform, JsonValue } from './transforms/gltf-transform.js';
export declare class GltfLoader {
    supportedFormatList: any[];
    textureLoader: TextureLoaderBase;
    preCacheTransforms: GltfTransform[];
    postCacheTransforms: GltfTransform[];
    constructor(textureLoader: TextureLoaderBase, transforms?: (typeof GltfTransform)[], loaderOptions?: any);
    loadFromUrl(url: string, userOptions?: any): Promise<JsonValue>;
    loadFromBinary(arrayBuffer: ArrayBuffer, options?: any): Promise<JsonValue>;
    loadFromJson(gltf: JsonValue, options?: any): Promise<JsonValue>;
    clearCache(): void;
}
