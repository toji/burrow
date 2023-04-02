/// <reference types="dist" />
import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
import { PbrMaterialDescriptor, RenderMaterial } from '../material/material.js';
import { RenderGeometryManager } from './render-geometry.js';
import { RenderMaterialManager } from './render-material.js';
export declare class RendererBase {
    device: GPUDevice;
    renderGeometryManager: RenderGeometryManager;
    renderMaterialManager: RenderMaterialManager;
    constructor(device: GPUDevice);
    createGeometry(desc: GeometryDescriptor): RenderGeometry;
    createMaterial(desc: PbrMaterialDescriptor): RenderMaterial;
}
