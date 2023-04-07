/// <reference types="dist" />
import { Vec3Like, Vec4Like } from "../../third-party/gl-matrix/dist/src/index.js";
export interface PbrMaterialDescriptor {
    label?: string;
    sampler?: GPUSampler;
    baseColorFactor?: Vec4Like;
    baseColorTexture?: GPUTexture;
    normalTexture?: GPUTexture;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: GPUTexture;
    emissiveFactor?: Vec3Like;
    emissiveTexture?: GPUTexture;
    occlusionTexture?: GPUTexture;
    occlusionStrength?: number;
    transparent?: boolean;
    doubleSided?: boolean;
    alphaCutoff?: number;
    unlit?: boolean;
}
export declare class RenderMaterial {
    bindGroup: GPUBindGroup;
    transparent: boolean;
    doubleSided: boolean;
    discard: boolean;
    unlit: boolean;
    constructor(bindGroup: GPUBindGroup, transparent: boolean, doubleSided: boolean, discard: boolean, unlit: boolean);
    get key(): number;
}
