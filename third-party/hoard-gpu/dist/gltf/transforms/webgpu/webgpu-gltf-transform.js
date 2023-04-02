import { GltfTransform } from '../gltf-transform.js';
export class WebGpuGltfTransform extends GltfTransform {
    static preCache = false;
    device;
    constructor(loaderOptions) {
        super(loaderOptions);
        this.device = loaderOptions.device;
        if (!this.device) {
            throw new Error('A device must be specified as part of the loader options');
        }
    }
    setGpuExtras(obj, gpuExtras) {
        let extras = obj.extras;
        if (extras === undefined) {
            obj.extras = { gpu: gpuExtras };
        }
        else if (extras.gpu === undefined) {
            extras.gpu = gpuExtras;
        }
        else {
            Object.assign(extras.gpu, gpuExtras);
        }
    }
}
//# sourceMappingURL=webgpu-gltf-transform.js.map