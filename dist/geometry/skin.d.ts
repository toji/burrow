/// <reference types="dist" />
import { Mat4 } from "../../third-party/gl-matrix/dist/src/index.js";
import { AnimationTarget } from "../animation/animation.js";
import { RendererBase } from "../renderer/renderer-base.js";
export interface SkinDescriptor {
    inverseBindMatrices: Mat4[] | Float32Array;
    joints: number[];
}
export declare class RenderSkin {
    #private;
    renderer: RendererBase;
    bindGroup: GPUBindGroup;
    joints: number[];
    invBindBuffer: GPUBuffer;
    jointBuffer: GPUBuffer;
    constructor(renderer: RendererBase, bindGroup: GPUBindGroup, joints: number[], invBindBuffer: GPUBuffer, jointBuffer: GPUBuffer);
    updateJoints(animationTarget: AnimationTarget): void;
    clone(): RenderSkin;
}
