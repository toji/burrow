import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { CreateWebGpuTextures } from './create-webgpu-textures.js';
import { CreateWebGpuSamplers } from './create-webgpu-samplers.js';
// To make it easier to reference the WebGL enums that glTF uses.
const GL = WebGLRenderingContext;
// Resolves every buffer in the glTF file into an arrayBuffer.
export class ResolveTextureWebGpuResources extends WebGpuGltfTransform {
    static Dependencies = [
        CreateWebGpuTextures,
        CreateWebGpuSamplers,
    ];
    async transform(gltf, buffers, images, options, transformResults) {
        // Don't run this step until all
        await transformResults.get(CreateWebGpuTextures);
        for (const texture of gltf.textures) {
            let image;
            if (texture.extensions?.KHR_texture_basisu) {
                image = gltf.images[texture.extensions.KHR_texture_basisu.source];
            }
            else {
                image = gltf.images[texture.source];
            }
            if (!image.extras?.gpu?.texture) {
                continue;
            }
            this.setGpuExtras(texture, {
                texture: image.extras.gpu.texture,
                sampler: gltf.samplers[texture.sampler].extras.gpu.sampler
            });
        }
    }
}
//# sourceMappingURL=resolve-texture-webgpu-resources.js.map