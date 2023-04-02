/**
 * @file Loader which handles any image types supported directly by the browser.
 * @module ImageLoader
 */
import { TextureClient, WebTexture } from './texture-loader-base.js';
/**
 * Loader which handles any image types supported directly by the browser.
 */
export declare class ImageLoader {
    /**
     * Creates a ImageTextureLoader instance.
     * Should only be called by the WebTextureTool constructor.
     */
    constructor();
    /**
     * Which MIME types this loader supports.
     *
     * @returns {Array<string>} - An array of the MIME types this loader supports.
     */
    static supportedMIMETypes(): string[];
    /**
     * Load a supported file as a texture from the given Blob.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     * @param {Blob} blob - Blob containing the texture file data.
     * @param {object} options - Options for how the loaded texture should be handled.
     * @returns {Promise<module:WebTextureLoader.WebTextureResult>} - The WebTextureResult obtained from passing the
     * parsed file data to the client.
     */
    fromBlob(client: TextureClient, blob: Blob, options: any): Promise<WebTexture>;
    /**
     * Load a supported file as a texture from the given ArrayBuffer or ArrayBufferView.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     * @param {ArrayBuffer|ArrayBufferView} buffer - Buffer containing the texture file data.
     * @param {object} options - Options for how the loaded texture should be handled.
     * @returns {Promise<module:WebTextureLoader.WebTextureResult>} - The WebTextureResult obtained from passing the
     * parsed file data to the client.
     */
    fromBuffer(client: TextureClient, buffer: ArrayBuffer | ArrayBufferView, options: any): Promise<WebTexture>;
}
