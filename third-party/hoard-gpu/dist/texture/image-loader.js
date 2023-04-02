/**
 * @file Loader which handles any image types supported directly by the browser.
 * @module ImageLoader
 */
const MIME_TYPE_FORMATS = [
    'image/jpeg',
    'image/png',
    'image/apng',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/x-icon',
    'image/svg+xml',
];
/**
 * Loader which handles any image types supported directly by the browser.
 */
export class ImageLoader {
    /**
     * Creates a ImageTextureLoader instance.
     * Should only be called by the WebTextureTool constructor.
     */
    constructor() {
    }
    /**
     * Which MIME types this loader supports.
     *
     * @returns {Array<string>} - An array of the MIME types this loader supports.
     */
    static supportedMIMETypes() {
        return Object.keys(MIME_TYPE_FORMATS);
    }
    /**
     * Load a supported file as a texture from the given Blob.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     * @param {Blob} blob - Blob containing the texture file data.
     * @param {object} options - Options for how the loaded texture should be handled.
     * @returns {Promise<module:WebTextureLoader.WebTextureResult>} - The WebTextureResult obtained from passing the
     * parsed file data to the client.
     */
    async fromBlob(client, blob, options) {
        return client.fromImageBitmapBlob(blob, 'rgba8unorm', options);
    }
    /**
     * Load a supported file as a texture from the given ArrayBuffer or ArrayBufferView.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     * @param {ArrayBuffer|ArrayBufferView} buffer - Buffer containing the texture file data.
     * @param {object} options - Options for how the loaded texture should be handled.
     * @returns {Promise<module:WebTextureLoader.WebTextureResult>} - The WebTextureResult obtained from passing the
     * parsed file data to the client.
     */
    async fromBuffer(client, buffer, options) {
        const blob = new Blob([buffer], { type: options.mimeType });
        return this.fromBlob(client, blob, options);
    }
}
//# sourceMappingURL=image-loader.js.map