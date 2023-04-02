/**
 * This library offers a unified way of loading textures for both WebGL and WebGPU from various file formats, and in all
 * cases attempts to handle the loading as efficently as possible. Every effort made to prevent texture loading from
 * blocking the main thread, since that can often be one of the primary causes of jank during page startup or while
 * streaming in new assets.
 *
 * @file Library for loading various image sources as textures for WebGL or WebGPU
 * @module TextureLoaderBase
 */
import { ImageLoader } from './image-loader.js';
import { WorkerLoader } from './worker-loader.js';
import { CacheHelper } from '../common/cache-helper.js';
class BasicTextureData {
    type = '2d';
    format;
    size;
    arrayBuffer;
    mipLevelCount;
    bufferViews = [];
    constructor(format, width, height, imageData = null) {
        this.format = format;
        this.size = { width: Math.max(1, width), height: Math.max(1, height) };
        this.mipLevelCount = 0;
        this.arrayBuffer = imageData.buffer;
        this.bufferViews = [{
                levelSize: this.size,
                level: 0,
                layer: 0,
                face: 0,
                byteOffset: imageData.byteOffset,
                byteLength: imageData.byteLength,
            }];
    }
}
/**
 * Associates a set of extensions with a specifc loader.
 */
class ExtensionHandler {
    mimeTypes;
    callback;
    loader = null;
    /**
     * Creates an ExtensionHandler.
     *
     * @param {Array<string>} extensions - List of extensions that this loader can handle.
     * @param {Function} callback - Callback which returns an instance of the loader.
     */
    constructor(mimeTypes, callback) {
        this.mimeTypes = mimeTypes;
        this.callback = callback;
    }
    /**
     * Gets the loader associated with this extension set. Creates an instance by calling the callback if one hasn't been
     * instantiated previously.
     *
     * @returns {object} Texture Loader instance.
     */
    getLoader() {
        if (!this.loader) {
            this.loader = this.callback();
        }
        return this.loader;
    }
}
const EXTENSION_MIME_TYPES = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    apng: 'image/apng',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    ico: 'image/x-icon',
    cur: 'image/x-icon',
    svg: 'image/svg+xml',
    basis: 'image/basis',
    ktx: 'image/ktx',
    ktx2: 'image/ktx2',
    dds: 'image/vnd.ms-dds',
};
const EXTENSION_HANDLERS = [
    new ExtensionHandler(ImageLoader.supportedMIMETypes(), () => new ImageLoader()),
    //new ExtensionHandler(['image/basis'], () => new WorkerLoader('workers/basis/basis-worker.js')),
    new ExtensionHandler(['image/ktx', 'image/ktx2'], () => new WorkerLoader('ktx/ktx-worker.js')),
    //new ExtensionHandler(['image/vnd.ms-dds'], () => new WorkerLoader('workers/dds-worker.js')),
];
const TMP_ANCHOR = document.createElement('a');
const DEFAULT_URL_OPTIONS = {
    mimeType: null,
    mipmaps: true,
    colorSpace: 'default',
};
function getMimeTypeLoader(loaders, mimeType) {
    if (!mimeType) {
        throw new Error('A valid MIME type must be specified.');
    }
    let typeHandler = loaders[mimeType];
    if (!typeHandler) {
        typeHandler = loaders['*'];
    }
    // Get the appropriate loader for the extension. Will instantiate the loader instance the first time it's
    // used.
    const loader = typeHandler.getLoader();
    if (!loader) {
        throw new Error(`Failed to get loader for MIME type "${mimeType}"`);
    }
    return loader;
}
// Wraps a TextureClient to cache any results sent to it.
class CachingClient {
    #client;
    #imageCache;
    constructor(client, imageCache) {
        this.#client = client;
        this.#imageCache = new CacheHelper(imageCache);
    }
    async loadFromCache(uri, textureOptions) {
        const image = await this.#imageCache.getMulti(uri);
        if (image) {
            const metadata = image.metadata;
            if (metadata['type'] === 'imageBitmap') {
                return this.#client.fromImageBitmapBlob(image.blob, metadata['format'], textureOptions);
            }
            else {
                const textureData = {
                    ...metadata,
                    arrayBuffer: image.arrayBuffer,
                };
                return this.#client.fromTextureData(textureData, textureOptions);
            }
        }
        return null;
    }
    supportedFormats() {
        return this.#client.supportedFormats();
    }
    fromImageBitmapBlob(blob, format, options) {
        if (options.cacheUrl) {
            const metadata = {
                type: 'imageBitmap',
                format,
            };
            this.#imageCache.setMulti(options.cacheUrl, {
                metadata,
                blob
            });
        }
        return this.#client.fromImageBitmapBlob(blob, format, options);
    }
    fromTextureData(textureData, options) {
        if (options.cacheUrl) {
            const metadata = {
                type: 'textureData',
                format: textureData.format,
            };
            this.#imageCache.setMulti(options.cacheUrl, {
                metadata,
                arrayBuffer: textureData.arrayBuffer
            });
        }
        return this.#client.fromTextureData(textureData, options);
    }
    destroy() {
        this.#client.destroy();
    }
}
/**
 * Base texture loader class.
 * Must not be used directly, create an instance of WebGLTextureLoader or WebGPUTextureLoader instead.
 */
export class TextureLoaderBase {
    #client;
    #cachingClient;
    #loaders = {};
    /**
     * WebTextureTool constructor. Must not be called by applications directly.
     * Create an instance of WebGLTextureTool or WebGPUTextureTool as needed instead.
     *
     * @param {object} client - The WebTextureClient which will upload the texture data to the GPU.
     */
    constructor(client, imageCache = null) {
        // If an imageCache is provided, wrap the client in a CachingClient that will cache the
        // intermediate results
        if (imageCache) {
            this.#client = this.#cachingClient = new CachingClient(client, imageCache);
        }
        else {
            this.#client = client;
        }
        // Map every available extension to it's associated handler
        for (const extensionHandler of EXTENSION_HANDLERS) {
            for (const mimeType of extensionHandler.mimeTypes) {
                this.#loaders[mimeType] = extensionHandler;
            }
        }
        // Register one last "fallback" extension. Anything that we receive that has an unrecognized extension will try to
        // load with the ImageTextureLoader.
        this.#loaders['*'] = EXTENSION_HANDLERS[0];
    }
    get isCaching() {
        return this.#cachingClient != null;
    }
    /** Loads a texture from the given URL
     *
     * @param {string} url - URL of the file to load.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    async fromUrl(url, textureOptions = {}) {
        if (!this.#client) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        // Use this to resolve to a full URL.
        TMP_ANCHOR.href = url;
        // Check to see if the image is in the cache first
        if (this.#cachingClient) {
            const cachedTexture = this.#cachingClient.loadFromCache(TMP_ANCHOR.href, textureOptions);
            if (cachedTexture) {
                return cachedTexture;
            }
        }
        // Image not in cache, load it normally. Always load URLs as Blobs.
        textureOptions.cacheUrl = TMP_ANCHOR.href;
        const response = await fetch(TMP_ANCHOR.href);
        return this.fromBlob(await response.blob(), textureOptions);
    }
    /** Loads a texture from the given blob
     *
     * @param {Blob} blob - Blob containing the texture file data.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    async fromBlob(blob, textureOptions = {}) {
        if (!this.#client) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        const options = Object.assign({}, DEFAULT_URL_OPTIONS, textureOptions);
        const loader = getMimeTypeLoader(this.#loaders, blob.type);
        return loader.fromBlob(this.#client, blob, options);
    }
    /** Loads a texture from the given blob
     *
     * @param {ArrayBuffer|ArrayBufferView} buffer - Buffer containing the texture file data.
     * @param {object} textureOptions - Options for how the loaded texture should be handled.
     * @returns {Promise<WebTextureResult>} - Promise which resolves to the completed WebTextureResult.
     */
    async fromBuffer(buffer, textureOptions = {}) {
        if (!this.#client) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        const options = Object.assign({}, DEFAULT_URL_OPTIONS, textureOptions);
        if (!options.mimeType && options.filename) {
            const extIndex = options.filename.lastIndexOf('.');
            const extension = extIndex > -1 ? options.filename.substring(extIndex + 1).toLowerCase() : null;
            options.mimeType = EXTENSION_MIME_TYPES[extension];
        }
        const loader = getMimeTypeLoader(this.#loaders, options.mimeType);
        return loader.fromBuffer(this.#client, buffer, options);
    }
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
    fromColor(r, g, b, a = 1.0, format = 'rgba8unorm') {
        if (!this.#client) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        if (format != 'rgba8unorm' && format != 'rgba8unorm-srgb') {
            throw new Error('fromColor only supports "rgba8unorm" and "rgba8unorm-srgb" formats');
        }
        const data = new Uint8Array([r * 255, g * 255, b * 255, a * 255]);
        return this.#client.fromTextureData(new BasicTextureData(format, 1, 1, data), false);
    }
    /**
     * Creates a noise texture with the specified dimensions. (rgba8unorm format)
     *
     * @param {number} width - Width of the noise texture
     * @param {number} height - Height of the noise texture
     * @returns {WebTextureResult} - Completed WebTextureResult
     */
    fromNoise(width, height) {
        // TODO: Better noise, more noise varieties, and more texture formats.
        if (!this.#client) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        const data = new Uint8Array(width * height * 4);
        for (let i = 0; i < data.length; ++i) {
            data[i] = Math.random() * 255;
        }
        return this.#client.fromTextureData(new BasicTextureData('rgba8unorm', width, height, data), false);
    }
    /**
     * Destroys the texture tool and stops any in-progress texture loads that have been started.
     *
     * @returns {void}
     */
    destroy() {
        if (this.#client) {
            this.#client.destroy();
            this.#client = null;
        }
    }
}
//# sourceMappingURL=texture-loader-base.js.map