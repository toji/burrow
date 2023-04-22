/// <reference types="dist" />
export declare class SsaoRenderer {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    bindGroupLayout: GPUBindGroupLayout;
    sampler: GPUSampler;
    sampleBuffer: GPUBuffer;
    blurPipelineA: GPURenderPipeline;
    blurPipelineB: GPURenderPipeline;
    blurTexture: GPUTexture;
    blurTextureView: GPUTextureView;
    blurBindGroup: GPUBindGroup;
    constructor(device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat);
    render(encoder: GPUCommandEncoder, frameBindGroup: GPUBindGroup, depthTextureView: GPUTextureView, normalTextureView: GPUTextureView, targetTexture: GPUTexture): void;
}
