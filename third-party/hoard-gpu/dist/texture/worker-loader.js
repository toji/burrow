/**
 * Generic loader which handles texture loading in a worker in order to prevent blocking the main thread.
 *
 * @file Loader that operates a worker script
 * @module WorkerLoader
 */
import { WorkerPool } from '../workers/worker-pool.js';
/**
 * Loader which handles Basis Universal files.
 */
export class WorkerLoader extends WorkerPool {
    /**
     * Creates a WorkerLoader instance.
     *
     * @param {string} relativeWorkerPath - Path to the worker script to load, relative to this file.
     */
    constructor(relativeWorkerPath) {
        super(relativeWorkerPath);
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
        const arrayBuffer = await blob.arrayBuffer();
        const textureData = await this.dispatch({
            arrayBuffer,
            supportedFormats: client.supportedFormats(),
            mipmaps: options.mipmaps,
            extension: options.extension
        }, [arrayBuffer]);
        return client.fromTextureData(textureData, options);
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
    async fromBuffer(client, arrayBuffer, options) {
        const textureData = await this.dispatch({
            arrayBuffer,
            supportedFormats: client.supportedFormats(),
            mipmaps: options.mipmaps,
            extension: options.extension
        }); // TODO: Option to transfer buffer
        return client.fromTextureData(textureData, options);
    }
}
//# sourceMappingURL=worker-loader.js.map