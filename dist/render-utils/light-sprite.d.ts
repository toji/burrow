/// <reference types="dist" />
export declare class LightSpriteRenderer {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    constructor(device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout);
    render(renderPass: GPURenderPassEncoder, lightCount: number): void;
}
