/// <reference types="dist" />
import { Mat4 } from "../../third-party/gl-matrix/dist/src/index.js";
import { SceneObject } from "../scene/node.js";
export interface SkinDescriptor {
    inverseBindMatrices: Mat4[] | Float32Array;
    joints: SceneObject[];
}
export declare class RenderSkin {
    #private;
    device: GPUDevice;
    bindGroup: GPUBindGroup;
    joints: SceneObject[];
    jointBuffer: GPUBuffer;
    constructor(device: GPUDevice, bindGroup: GPUBindGroup, joints: SceneObject[], jointBuffer: GPUBuffer);
    updateJoints(): void;
}
