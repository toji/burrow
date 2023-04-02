/**
 * This library offers a unified way of loading textures for both WebGL and WebGPU from various file formats, and in all
 * cases attempts to handle the loading as efficently as possible. Every effort made to prevent texture loading from
 * blocking the main thread, since that can often be one of the primary causes of jank during page startup or while
 * streaming in new assets.
 *
 * @file Library for loading various image sources as textures for WebGL or WebGPU
 * @module TextureLoaderBase
 */
/// <reference types="dist" />
export type WebTexture = GPUTexture;
type TextureDataType = "3d" | "2d" | "cube-array" | "cube" | "2d-array";
interface TextureBufferView {
    levelSize: GPUExtent3DDictStrict;
    level: number;
    layer: number;
    face: number;
    byteOffset: number;
    byteLength: number;
}
export interface TextureData {
    type: TextureDataType;
    format: GPUTextureFormat;
    size: GPUExtent3DDictStrict;
    mipLevelCount: number;
    bufferViews: TextureBufferView[];
    arrayBuffer: ArrayBuffer;
}
export interface TextureClient {
    supportedFormats(): string[];
    fromImageBitmapBlob(blob: Blob, format: GPUTextureFormat, options: any): Promise<WebTexture>;
    fromTextureData(textureData: TextureData, options: any): WebTexture;
    destroy(): void;
}
export interface TextureLoader {
    fromBlob(client: TextureClient, blob: Blob, options: any): Promise<WebTexture>;
    fromBuffer(client: TextureClient, buffer: ArrayBuffer | ArrayBufferView, options: any): Promise<WebTexture>;
}
/**
 * Base texture loader class.
 * Must not be used directly, create an instance of WebGLTextureLoader or WebGPUTextureLoader instead.
 */
export declare class TextureLoaderBase {
    #private;
    /**
     * WebTextureTool constructor. Must not be called by applications directly.
     * Create an instance of WebGLTextureTool or WebGPUTextureTool as needed instead.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     */
    constructor(client: TextureClient, imageCache?: Cache);
    get isCaching(): boolean;
    /** Loads a texture from the given URL
     *
     * @param {string} url - URL of the file to load.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    fromUrl(url: string, textureOptions?: any): Promise<WebTexture>;
    /** Loads a texture from the given blob
     *
     * @param {Blob} blob - Blob containing the texture file data.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    fromBlob(blob: Blob, textureOptions?: any): Promise<WebTexture>;
    /** Loads a texture from the given blob
     *
     * @param {ArrayBuffer|ArrayBufferView} buffer - Buffer containing the texture file data.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    fromBuffer(buffer: ArrayBuffer | ArrayBufferView, textureOptions?: any): Promise<WebTexture>;
    /**
     * Creates a 1x1 texture with the specified color.
     *
     * @param {number} r - Red channel value
     * @param {number} g - Green channel value
     * @param {number} b - Blue channel value
     * @param {number} [a=1.0] - Alpha channel value
     * @param {WebTextureFormat} [format='rgba8unorm'] - Format to create the texture with
     * @returns {WebTextureResult} - Completed WebTextureResult
     */
    fromColor(r: number, g: number, b: number, a?: number, format?: GPUTextureFormat): WebTexture;
    /**
     * Creates a noise texture with the specified dimensions. (rgba8unorm format)
     *
     * @param {number} width - Width of the noise texture
     * @param {number} height - Height of the noise texture
     * @returns {WebTextureResult} - Completed WebTextureResult
     */
    fromNoise(width: number, height: number): WebTexture;
    /**
     * Destroys the texture tool and stops any in-progress texture loads that have been started.
     *
     * @returns {void}
     */
    destroy(): void;
}
export {};
