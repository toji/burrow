import { GltfLoader } from './gltf-loader.js';
import { CreateWebGpuBuffers } from './transforms/webgpu/create-webgpu-buffers.js';
import { ResolveTextureWebGpuResources } from './transforms/webgpu/resolve-texture-webgpu-resources.js';
import { ResolveDracoPrimitives } from './transforms/resolve-draco-primitives.js';
import { ResolveSparseAccessors } from './transforms/resolve-sparse-accessors.js';
import { WebGpuTextureLoader } from '../texture/webgpu/webgpu-texture-loader.js';
// Version of the GltfLoader base class that includes necessary transforms for loading WebGPU
// resources
export class WebGpuGltfLoader extends GltfLoader {
    constructor(device, transforms = [], loaderOptions = {}) {
        loaderOptions.device = device;
        transforms.push(ResolveDracoPrimitives, ResolveSparseAccessors, CreateWebGpuBuffers, ResolveTextureWebGpuResources);
        // TODO: Also allow this to be passed in externally
        const textureLoader = new WebGpuTextureLoader(device, loaderOptions.cache);
        super(textureLoader, transforms, loaderOptions);
    }
}
//# sourceMappingURL=webgpu-gltf-loader.js.map