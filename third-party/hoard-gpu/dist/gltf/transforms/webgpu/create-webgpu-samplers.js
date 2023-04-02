import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
const GL = WebGLRenderingContext;
// Generates a key that globally represents each possible sampler variant.
function getSamplerKey(sampler) {
    let key = 0;
    switch (sampler.wrapS) {
        case GL.CLAMP_TO_EDGE:
            key |= 0x0000;
            break;
        case GL.MIRRORED_REPEAT:
            key |= 0x0001;
            break;
        default:
            key |= 0x0002;
            break;
    }
    switch (sampler.wrapT) {
        case GL.CLAMP_TO_EDGE:
            key |= 0x0000;
            break;
        case GL.MIRRORED_REPEAT:
            key |= 0x0010;
            break;
        default:
            key |= 0x0020;
            break;
    }
    switch (sampler.magFilter) {
        case GL.NEAREST:
            key |= 0x0000;
            break;
        default:
            key |= 0x0100;
            break;
    }
    switch (sampler.minFilter) {
        case GL.LINEAR:
            key |= 0x0000;
            break;
        case GL.LINEAR_MIPMAP_NEAREST:
            key |= 0x1000;
            break;
        case GL.NEAREST_MIPMAP_LINEAR:
            key |= 0x2000;
            break;
        case GL.LINEAR_MIPMAP_LINEAR:
            key |= 0x3000;
            break;
        default:
            key |= 0x4000;
            break;
    }
    return key;
}
function wrapToAddressMode(wrap) {
    switch (wrap) {
        case GL.CLAMP_TO_EDGE: return 'clamp-to-edge';
        case GL.MIRRORED_REPEAT: return 'mirror-repeat';
        default: return 'repeat';
    }
}
export class CreateWebGpuSamplers extends WebGpuGltfTransform {
    constructor(loaderOptions) {
        super(loaderOptions);
        this.samplerCache = new Map();
    }
    transform(gltf) {
        for (const sampler of gltf.samplers) {
            // Look up the sampler in a cache that spans all glTF's loaded with this
            // loader. Only create one if an matching sampler isn't found.
            const key = getSamplerKey(sampler);
            let gpuSampler = this.samplerCache.get(key);
            if (!gpuSampler) {
                const descriptor = {
                    addressModeU: wrapToAddressMode(sampler.wrapS),
                    addressModeV: wrapToAddressMode(sampler.wrapT),
                };
                switch (sampler.magFilter) {
                    case GL.NEAREST: break;
                    default:
                        descriptor.magFilter = 'linear';
                        break;
                }
                switch (sampler.minFilter) {
                    case GL.NEAREST: break;
                    case GL.LINEAR:
                    case GL.LINEAR_MIPMAP_NEAREST:
                        descriptor.minFilter = 'linear';
                        break;
                    case GL.NEAREST_MIPMAP_LINEAR:
                        descriptor.mipmapFilter = 'linear';
                        break;
                    default:
                        descriptor.minFilter = 'linear';
                        descriptor.mipmapFilter = 'linear';
                        break;
                }
                gpuSampler = this.device.createSampler(descriptor);
                this.samplerCache.set(key, gpuSampler);
            }
            this.setGpuExtras(sampler, { sampler: gpuSampler });
        }
    }
}
//# sourceMappingURL=create-webgpu-samplers.js.map