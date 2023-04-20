/// <reference types="dist" />
export declare class SsaoRenderer {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    bindGroupLayout: GPUBindGroupLayout;
    sampler: GPUSampler;
    sampleBuffer: GPUBuffer;
    constructor(device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat);
    render(renderPass: GPURenderPassEncoder, depthTextureView: GPUTextureView, normalTextureView: GPUTextureView): void;
}
