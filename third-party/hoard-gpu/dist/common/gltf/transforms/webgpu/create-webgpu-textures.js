import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
export class CreateWebGpuTextures extends WebGpuGltfTransform {
    transform(gltf, buffers, images, options, transformResults) {
        const createTextureFromImage = async (imageIndex) => {
            const image = gltf.images[imageIndex];
            const texture = await images.getImage(imageIndex);
            this.setGpuExtras(image, { texture });
            return texture;
        };
        for (const imageIndex in gltf.images) {
            const image = gltf.images[imageIndex];
            this.setGpuExtras(image, { promise: createTextureFromImage(imageIndex) });
        }
        return Promise.all(gltf.images.map(image => image.extras?.gpu?.promise));
    }
}
//# sourceMappingURL=create-webgpu-textures.js.map