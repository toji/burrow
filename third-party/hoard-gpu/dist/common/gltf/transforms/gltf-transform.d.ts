import { BufferManager } from '../buffer-manager.js';
import { ImageManager } from '../image-manager.js';
export interface JsonValue {
    [x: string]: null | string | number | boolean | JsonValue | JsonArray;
}
export interface JsonArray extends Array<JsonValue> {
}
export interface Gltf extends JsonValue {
    asset?: JsonValue;
    buffers?: JsonArray;
    bufferViews?: JsonArray;
    accessors?: JsonArray;
    nodes?: JsonArray;
    meshes?: JsonArray;
    textures?: JsonArray;
    samplers?: JsonArray;
    animations?: JsonArray;
    materials?: JsonArray;
}
export declare abstract class GltfTransform {
    static Dependencies: any[];
    static preCache: boolean;
    constructor(loaderOptions: any);
    abstract transform(gltf: JsonValue, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): any;
    setExtras(obj: JsonValue, extras: JsonValue): void;
}
