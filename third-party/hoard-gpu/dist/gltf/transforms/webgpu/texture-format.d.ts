/**
 * Texture Format
 */
export type WebTextureFormat = string;
/**
 * Texture Format
 *
 * @typedef {string} WebTextureFormat
 */
export const WebTextureFormat: {
    rgb8unorm: {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    rgba8unorm: {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    'rgb8unorm-srgb': {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    'rgba8unorm-srgb': {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    rgb565unorm: {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    rgba4unorm: {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    rgba5551unorm: {
        canGenerateMipmaps: boolean;
        gl: {
            format: number;
            type: number;
            sizedFormat: number;
        };
    };
    bgra8unorm: {
        canGenerateMipmaps: boolean;
    };
    'bgra8unorm-srgb': {
        canGenerateMipmaps: boolean;
    };
    'bc1-rgb-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'bc2-rgba-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'bc3-rgba-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'bc7-rgba-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'etc1-rgb-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'etc2-rgba8unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'astc-4x4-rgba-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'pvrtc1-4bpp-rgb-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
    'pvrtc1-4bpp-rgba-unorm': {
        gl: {
            texStorage: boolean;
            sizedFormat: number;
        };
        compressed: {
            blockBytes: number;
            blockWidth: number;
            blockHeight: number;
        };
    };
};
