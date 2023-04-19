/// <reference types="dist" />
export declare class SkyboxRenderer {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    skyboxVertexBuffer: GPUBuffer;
    skyboxIndexBuffer: GPUBuffer;
    constructor(device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, depthFormat: GPUTextureFormat);
    render(renderPass: GPURenderPassEncoder): void;
}
