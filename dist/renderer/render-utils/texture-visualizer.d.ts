/// <reference types="dist" />
export declare class TextureVisualizer {
    device: GPUDevice;
    pipelines: Map<string, GPURenderPipeline>;
    sampler: GPUSampler;
    uniformBuffer: GPUBuffer;
    constructor(device: GPUDevice, colorFormat?: GPUTextureFormat, depthFormat?: GPUTextureFormat);
    render(renderPass: GPURenderPassEncoder, texture: GPUTexture, mipLevel?: number, layer?: number, rangeMin?: number, rangeMax?: number, aspect?: GPUTextureAspect, alphaOnly?: boolean): void;
}
