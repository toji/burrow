/// <reference types="dist" />
export declare class SsaoRenderer {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    bindGroupLayout: GPUBindGroupLayout;
    sampler: GPUSampler;
    sampleBuffer: GPUBuffer;
    targetScale: number;
    blurPipelineA: GPURenderPipeline;
    blurPipelineB: GPURenderPipeline;
    ssaoTexture: GPUTexture;
    ssaoTextureView: GPUTextureView;
    blurTexture: GPUTexture;
    blurTextureView: GPUTextureView;
    blurABindGroup: GPUBindGroup;
    blurBBindGroup: GPUBindGroup;
    constructor(device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat);
    render(encoder: GPUCommandEncoder, frameBindGroup: GPUBindGroup, depthTextureView: GPUTextureView, normalTextureView: GPUTextureView, targetTexture: GPUTexture): void;
}
