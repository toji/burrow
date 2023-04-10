/// <reference types="dist" />
import { RenderGeometry } from "../../geometry/geometry.js";
import { RenderSkin } from "../../geometry/skin.js";
import { RendererBase } from "../renderer-base.js";
export declare class ComputeSkinningManager {
    #private;
    renderer: RendererBase;
    constructor(renderer: RendererBase);
    skinGeometry(computePass: GPUComputePassEncoder, geometry: RenderGeometry, skin: RenderSkin): RenderGeometry;
}
