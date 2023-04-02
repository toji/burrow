/**
 * Texture Format
 *
 * @typedef {string} WebTextureFormat
 */
// Additional format data used by Web Texture Tool, based off WebGPU formats.
// WebGL equivalents given where possible.
export const WebTextureFormat = {
    // Uncompressed formats
    'rgb8unorm': { canGenerateMipmaps: true },
    'rgba8unorm': { canGenerateMipmaps: true },
    'rgb8unorm-srgb': { canGenerateMipmaps: true },
    'rgba8unorm-srgb': { canGenerateMipmaps: true },
    'rgb565unorm': { canGenerateMipmaps: true },
    'rgba4unorm': { canGenerateMipmaps: true },
    'rgba5551unorm': { canGenerateMipmaps: true },
    'bgra8unorm': { canGenerateMipmaps: true },
    'bgra8unorm-srgb': { canGenerateMipmaps: true },
    // Floating point textures
    'rg11b10ufloat': { canGenerateMipmaps: false },
    // Compressed formats
    'bc1-rgb-unorm': {
        compressed: { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    },
    'bc2-rgba-unorm': {
        compressed: { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    },
    'bc3-rgba-unorm': {
        compressed: { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    },
    'bc7-rgba-unorm': {
        compressed: { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    },
    'etc1-rgb-unorm': {
        compressed: { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    },
    'etc2-rgba8unorm': {
        compressed: { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    },
    'astc-4x4-rgba-unorm': {
        compressed: { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    },
    'pvrtc1-4bpp-rgb-unorm': {
        compressed: { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    },
    'pvrtc1-4bpp-rgba-unorm': {
        compressed: { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    },
};
//# sourceMappingURL=texture-format.js.map