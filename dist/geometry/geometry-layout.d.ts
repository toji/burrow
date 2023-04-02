/// <reference types="dist" />
export declare class GeometryLayout {
    #private;
    id: number;
    buffers: GPUVertexBufferLayout[];
    topology: GPUPrimitiveTopology;
    stripIndexFormat?: GPUIndexFormat;
    constructor(buffers: GPUVertexBufferLayout[], topology: GPUPrimitiveTopology, indexFormat?: GPUIndexFormat);
    get locationsUsed(): Set<number>;
    getLocationFormat(shaderLocation: number): GPUVertexFormat;
    serializeToBuffer(): ArrayBuffer;
    serializeToString(): string;
    static deserializeFromBuffer(inBuffer: ArrayBuffer, bufferOffest?: number, bufferLength?: number): GeometryLayout;
    static deserializeFromString(value: string): GeometryLayout;
}
export declare class GeometryLayoutCache {
    #private;
    getLayout(id: number): Readonly<GeometryLayout>;
    addLayoutToCache(layout: GeometryLayout, key: string): Readonly<GeometryLayout>;
    deserializeLayout(key: string): Readonly<GeometryLayout>;
    createLayout(attribBuffers: GPUVertexBufferLayout[], topology: GPUPrimitiveTopology, indexFormat?: GPUIndexFormat): Readonly<GeometryLayout>;
}
