import { CacheHelper } from '../common/cache-helper.js';
export declare class BufferManager {
    #private;
    constructor(gltf: any, baseUrl: string, glbBinaryChunk?: ArrayBuffer);
    createBufferViewFromArrayBuffer(bufferPromise: Promise<ArrayBuffer>, bufferView: GltfBufferView): number;
    createEmptyBufferView(bufferView: any): number;
    removeBufferView(index: number): void;
    getBufferView(index: number): BufferView;
    get bufferViews(): Iterable<BufferView>;
    updateCache(gltf: any, cache: CacheHelper): Promise<void>;
}
interface GltfBufferView {
    buffer?: number;
    byteOffset?: number;
    byteLength?: number;
    byteStride?: number;
    target?: number;
    name?: string;
    extension?: any;
    extras?: any;
}
declare class BufferView implements GltfBufferView {
    #private;
    byteOffset: number;
    byteLength: number;
    byteStride: number;
    target: number;
    name: string;
    extension: any;
    extras: any;
    constructor(bufferView?: GltfBufferView);
    resolveWithArrayBuffer(arrayBuffer: ArrayBuffer): void;
    asByteArray(): Promise<Uint8Array>;
    toJson(overrideByteOffset?: number): GltfBufferView;
}
export {};
