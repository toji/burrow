/// <reference types="dist" />
import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
export declare class RenderGeometryManager {
    #private;
    device: GPUDevice;
    constructor(device: GPUDevice);
    createGeometry(desc: GeometryDescriptor): RenderGeometry;
}
