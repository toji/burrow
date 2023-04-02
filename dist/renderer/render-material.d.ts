/// <reference types="dist" />
import { PbrMaterialDescriptor, RenderMaterial } from '../material/material.js';
export declare class RenderMaterialManager {
    device: GPUDevice;
    materialBindGroupLayout: GPUBindGroupLayout;
    defaultSampler: GPUSampler;
    opaqueWhite: GPUTextureView;
    transparentBlack: GPUTextureView;
    defaultNormal: GPUTextureView;
    constructor(device: GPUDevice);
    createMaterial(desc: PbrMaterialDescriptor): RenderMaterial;
}
