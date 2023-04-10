/// <reference types="dist" />
import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
export declare const DefaultStride: {
    uint8x2: number;
    uint8x4: number;
    sint8x2: number;
    sint8x4: number;
    unorm8x2: number;
    unorm8x4: number;
    snorm8x2: number;
    snorm8x4: number;
    uint16x2: number;
    uint16x4: number;
    sint16x2: number;
    sint16x4: number;
    unorm16x2: number;
    unorm16x4: number;
    snorm16x2: number;
    snorm16x4: number;
    float16x2: number;
    float16x4: number;
    float32: number;
    float32x2: number;
    float32x3: number;
    float32x4: number;
    uint32: number;
    uint32x2: number;
    uint32x3: number;
    uint32x4: number;
    sint32: number;
    sint32x2: number;
    sint32x3: number;
    sint32x4: number;
};
export declare class RenderGeometryManager {
    #private;
    device: GPUDevice;
    constructor(device: GPUDevice);
    createGeometry(desc: GeometryDescriptor): RenderGeometry;
}
