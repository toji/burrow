/**
 * Supports loading textures for WebGPU, as well as providing common utilities that are not part of the core WebGPU API
 * such as mipmap generation.
 *
 * @file WebGPU client for the Web Texture Loader
 * @module WebGPUTextureLoader
 */
/// <reference types="dist" />
import { TextureLoaderBase } from '../texture-loader-base.js';
/**
 * Variant of TextureLoaderBase which produces WebGPU textures.
 */
export declare class WebGpuTextureLoader extends TextureLoaderBase {
    /**
     * Creates a WebTextureTool instance which produces WebGPU textures.
     *
     * @param {module:External.GPUDevice} device - WebGPU device to create textures with.
     */
    constructor(device: GPUDevice, imageCache?: Cache);
}
