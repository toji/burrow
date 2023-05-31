/// <reference types="dist" />
import { Mat4Like } from "../../../node_modules/gl-matrix/dist/esm/index.js";
import { WebGpuTextureLoader } from "../../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js";
type KerningMap = Map<number, Map<number, number>>;
export declare class MsdfFont {
    bindGroup: GPUBindGroup;
    lineHeight: number;
    chars: {
        [x: number]: any;
    };
    kernings: KerningMap;
    charCount: number;
    defaultChar: any;
    constructor(bindGroup: GPUBindGroup, lineHeight: number, chars: {
        [x: number]: any;
    }, kernings: KerningMap);
    getChar(charCode: number): any;
    getXAdvance(charCode: number, nextCharCode?: number): number;
}
export interface MsdfTextMeasurements {
    width: number;
    height: number;
    lineWidths: number[];
    printedCharCount: number;
}
export declare class MsdfText {
    device: GPUDevice;
    bindGroup: GPUBindGroup;
    measurements: MsdfTextMeasurements;
    font: MsdfFont;
    textBuffer: GPUBuffer;
    renderBundle: GPURenderBundle;
    constructor(device: GPUDevice, bindGroup: GPUBindGroup, measurements: MsdfTextMeasurements, font: MsdfFont, textBuffer: GPUBuffer);
    setTransform(matrix: Float32Array): void;
}
export interface MsdfTextFormattingOptions {
    centered?: boolean;
    pixelScale?: number;
}
export declare class MsdfTextRenderer {
    device: GPUDevice;
    fontBindGroupLayout: GPUBindGroupLayout;
    textBindGroupLayout: GPUBindGroupLayout;
    pipeline: GPURenderPipeline;
    sampler: GPUSampler;
    cameraUniformBuffer: GPUBuffer;
    renderBundleDescriptor: GPURenderBundleEncoderDescriptor;
    cameraArray: Float32Array;
    constructor(device: GPUDevice, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat);
    createFont(fontJsonUrl: string, textureLoader: WebGpuTextureLoader): Promise<MsdfFont>;
    formatText(font: MsdfFont, text: string, options?: MsdfTextFormattingOptions): MsdfText;
    measureText(font: MsdfFont, text: string, charCallback?: (x: number, y: number, line: number, char: any) => void): MsdfTextMeasurements;
    updateCamera(projection: Mat4Like, view: Mat4Like): void;
    render(renderPass: GPURenderPassEncoder, text: MsdfText): void;
}
export {};
