import { CacheHelper } from '../common/cache-helper.js';
import { GlTf, BufferView, GlTfId } from './gltf.js';
export declare class BufferManager {
    #private;
    constructor(gltf: GlTf, baseUrl: string, glbBinaryChunk?: ArrayBuffer);
    createBufferViewFromArrayBuffer(bufferPromise: Promise<ArrayBuffer>, bufferView: BufferView): number;
    createEmptyBufferView(bufferView: Partial<BufferView>): number;
    removeBufferView(index: number): void;
    getBufferView(index: number): ManagedBufferView;
    get bufferViews(): ManagedBufferView[];
    updateCache(gltf: any, cache: CacheHelper): Promise<void>;
}
export interface ResolvedBufferView extends BufferView {
    byteArray: Uint8Array;
}
export declare class ManagedBufferView implements BufferView {
    #private;
    buffer: GlTfId;
    byteOffset: number;
    byteLength: number;
    byteStride: number;
    target: number;
    name: string;
    extension: any;
    extras: any;
    constructor(bufferView: Partial<BufferView>);
    resolveWithArrayBuffer(arrayBuffer: ArrayBuffer): void;
    asByteArray(): Promise<Uint8Array>;
    toJson(overrideByteOffset?: number): BufferView;
    toResolvedBufferView(): Promise<ResolvedBufferView>;
}
