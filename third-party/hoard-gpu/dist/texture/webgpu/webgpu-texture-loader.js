/**
 * Supports loading textures for WebGPU, as well as providing common utilities that are not part of the core WebGPU API
 * such as mipmap generation.
 *
 * @file WebGPU client for the Web Texture Loader
 * @module WebGPUTextureLoader
 */
import { TextureLoaderBase } from '../texture-loader-base.js';
import { WebTextureFormat } from '../texture-format.js';
import { WebGPUMipmapGenerator } from './mipmap-generator.js';
const EXTENSION_FORMATS = {
    'texture-compression-bc': [
        'bc1-rgba-unorm',
        'bc2-rgba-unorm',
        'bc3-rgba-unorm',
        'bc7-rgba-unorm',
    ],
    'texture-compression-etc2': [
        'etc2-rgb8unorm',
        'etc2-rgb8a1unorm',
        'etc2-rgba8unorm',
        'eac-r11unorm',
        'eac-r11snorm',
        'eac-rg11unorm',
        'eac-rg11snorm',
    ],
    'texture-compression-astc': [
        'astc-4x4-unorm',
        'astc-5x4-unorm',
        'astc-5x5-unorm',
        'astc-6x5-unorm',
        'astc-6x6-unorm',
        'astc-8x5-unorm',
        'astc-8x6-unorm',
        'astc-8x8-unorm',
        'astc-10x5-unorm',
        'astc-10x6-unorm',
        'astc-10x8-unorm',
        'astc-10x10-unorm',
        'astc-12x10-unorm',
        'astc-12x12-unorm',
    ],
};
function formatForColorSpace(format, colorSpace) {
    switch (colorSpace) {
        case 'sRGB':
            return `${format}-srgb`;
        default:
            return format;
    }
}
/**
 * Determines the number of mip levels needed for a full mip chain given the width and height of texture level 0.
 *
 * @param {number} width of texture level 0.
 * @param {number} height of texture level 0.
 * @returns {number} Ideal number of mip levels.
 */
function calculateMipLevels(width, height) {
    return Math.floor(Math.log2(Math.max(width, height))) + 1;
}
/**
 * Variant of TextureLoaderBase which produces WebGPU textures.
 */
export class WebGpuTextureLoader extends TextureLoaderBase {
    /**
     * Creates a WebTextureTool instance which produces WebGPU textures.
     *
     * @param {module:External.GPUDevice} device - WebGPU device to create textures with.
     */
    constructor(device, imageCache = null) {
        super(new WebGpuTextureClient(device), imageCache);
    }
}
/**
 * Texture Client that interfaces with WebGPU.
 */
class WebGpuTextureClient {
    device;
    mipmapGenerator;
    supportedFormatList = [
        'rgba8unorm',
        'bgra8unorm',
        'rg11b10ufloat',
    ];
    /**
     * Creates a WebTextureClient instance which uses WebGPU.
     * Should not be called outside of the WebGLTextureTool constructor.
     *
     * @param {module:External.GPUDevice} device - WebGPU device to use.
     */
    constructor(device) {
        this.device = device;
        this.mipmapGenerator = new WebGPUMipmapGenerator(device);
        // Add any other formats that are exposed by WebGPU features.
        const featureList = device.features;
        if (featureList) { // Firefox seems to not support reporting features yet.
            for (const feature in EXTENSION_FORMATS) {
                if (featureList.has(feature)) {
                    const formats = EXTENSION_FORMATS[feature];
                    this.supportedFormatList.push(...formats);
                }
            }
        }
    }
    /**
     * Returns a list of the WebTextureFormats that this client can support.
     *
     * @returns {Array<module:WebTextureTool.WebTextureFormat>} - List of supported WebTextureFormats.
     */
    supportedFormats() {
        return this.supportedFormatList;
    }
    /**
     * Creates a GPUTexture from the given ImageBitmap.
     *
     * @param {module:External.ImageBitmap} imageBitmap - ImageBitmap source for the texture.
     * @param {module:WebTextureTool.WebTextureFormat} format - Format to store the texture as on the GPU. Must be an
     * uncompressed format.
     * @param {boolean} generateMipmaps - True if mipmaps are desired.
     * @returns {module:WebTextureTool.WebTextureResult} - Completed texture and metadata.
     */
    async fromImageBitmapBlob(blob, format, options) {
        if (!this.device) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        const imageBitmap = await createImageBitmap(blob);
        const generateMipmaps = options.mipmaps;
        const mipLevelCount = generateMipmaps ? calculateMipLevels(imageBitmap.width, imageBitmap.height) : 1;
        const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
        const textureDescriptor = {
            size: { width: imageBitmap.width, height: imageBitmap.height },
            format: formatForColorSpace(format, options.colorSpace),
            usage,
            mipLevelCount,
        };
        const texture = this.device.createTexture(textureDescriptor);
        this.device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture }, textureDescriptor.size);
        if (generateMipmaps) {
            this.mipmapGenerator.generateMipmap(texture);
        }
        return texture;
    }
    /**
     * Creates a GPUTexture from the given texture level data.
     *
     * @param {module:WebTextureTool.WebTextureData} textureData - Object containing data and layout for each image and
     * mip level of the texture.
     * @param {boolean} generateMipmaps - True if mipmaps generation is desired. Only applies if a single level is given
     * and the texture format is renderable.
     * @returns {module:WebTextureTool.WebTextureResult} - Completed texture and metadata.
     */
    fromTextureData(textureData, options) {
        if (!this.device) {
            throw new Error('Cannot create new textures after object has been destroyed.');
        }
        const wtFormat = WebTextureFormat[textureData.format];
        if (!wtFormat) {
            throw new Error(`Unknown format "${textureData.format}"`);
        }
        const blockInfo = wtFormat.compressed || { blockBytes: 4, blockWidth: 1, blockHeight: 1 };
        const generateMipmaps = options.mipmaps && wtFormat.canGenerateMipmaps;
        const mipLevelCount = textureData.mipLevelCount > 1 ? textureData.mipLevelCount :
            (generateMipmaps ? calculateMipLevels(textureData.width, textureData.height) : 1);
        const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
        const textureDescriptor = {
            size: {
                width: Math.ceil(textureData.size.width / blockInfo.blockWidth) * blockInfo.blockWidth,
                height: Math.ceil(textureData.size.height / blockInfo.blockHeight) * blockInfo.blockHeight,
                depthOrArrayLayers: textureData.size.depthOrArrayLayers,
            },
            format: formatForColorSpace(textureData.format, options.colorSpace),
            usage,
            mipLevelCount,
        };
        const texture = this.device.createTexture(textureDescriptor);
        for (const bufferView of textureData.bufferViews) {
            const bytesPerRow = Math.ceil(bufferView.levelSize.width / blockInfo.blockWidth) * blockInfo.blockBytes;
            // TODO: It may be more efficient to upload the mip levels to a buffer and copy to the texture, but this makes
            // the code significantly simpler and avoids an alignment issue I was seeing previously, so for now we'll take
            // the easy route.
            this.device.queue.writeTexture({
                texture: texture,
                mipLevel: bufferView.level,
                origin: { z: bufferView.layer },
            }, textureData.arrayBuffer, {
                offset: bufferView.byteOffset,
                bytesPerRow,
            }, {
                width: Math.ceil(bufferView.levelSize.width / blockInfo.blockWidth) * blockInfo.blockWidth,
                height: Math.ceil(bufferView.levelSize.height / blockInfo.blockHeight) * blockInfo.blockHeight,
            });
        }
        if (generateMipmaps) {
            this.mipmapGenerator.generateMipmap(texture);
        }
        return texture;
    }
    /**
     * Destroy this client.
     * The client is unusable after calling destroy().
     *
     * @returns {void}
     */
    destroy() {
        this.device = null;
    }
}
//# sourceMappingURL=webgpu-texture-loader.js.map