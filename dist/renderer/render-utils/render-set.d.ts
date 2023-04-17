/// <reference types="dist" />
import { Mat4 } from "../../../node_modules/gl-matrix/dist/esm/index.js";
import { GeometryLayout } from "../../geometry/geometry-layout.js";
import { RenderGeometry } from "../../geometry/geometry.js";
import { RenderSkin } from "../../geometry/skin.js";
import { RenderMaterial } from "../../material/material.js";
import { SceneMesh } from "../deferred-renderer.js";
interface GeometryInstances {
    skin?: RenderSkin;
    firstInstance: number;
    instanceCount: number;
    transforms: Mat4[];
}
export type InstancedGeometry = Map<RenderGeometry, GeometryInstances>;
export type MaterialGeometry = Map<RenderMaterial, InstancedGeometry>;
export type PipelineMaterials = Map<GPURenderPipeline, MaterialGeometry>;
export interface RenderSet {
    totalInstanceCount: number;
    pipelineMaterials: PipelineMaterials;
    instanceBindGroup: GPUBindGroup;
}
export declare abstract class RenderSetProvider {
    #private;
    device: GPUDevice;
    defaultMaterial: RenderMaterial;
    instanceBindGroupLayout: GPUBindGroupLayout;
    instanceBindGroup: GPUBindGroup;
    instanceArray: Float32Array;
    instanceBuffer: GPUBuffer;
    constructor(device: GPUDevice, defaultMaterial: RenderMaterial);
    getKey(layout: Readonly<GeometryLayout>, material: RenderMaterial, skinned: boolean): string;
    meshFilter(mesh: SceneMesh): boolean;
    abstract createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, skinned: boolean, key: string): GPURenderPipeline;
    getRenderSet(meshes: SceneMesh[]): RenderSet;
}
export {};
