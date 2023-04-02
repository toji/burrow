/// <reference types="dist" />
export declare class WebGPUMipmapGenerator {
    device: GPUDevice;
    sampler: GPUSampler;
    mipmapShaderModule: GPUShaderModule;
    bindGroupLayout: GPUBindGroupLayout;
    pipelineLayout: GPUPipelineLayout;
    pipelines: Map<GPUTextureFormat, GPURenderPipeline>;
    constructor(device: GPUDevice);
    getMipmapPipeline(format: GPUTextureFormat): GPURenderPipeline;
    /**
     * Generates mipmaps for the given GPUTexture from the data in level 0.
     *
     * @param texture - Texture to generate mipmaps for.
     */
    generateMipmap(texture: GPUTexture): GPUTexture;
}
