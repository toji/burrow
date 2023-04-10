import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { SetDefaults } from '../set-defaults.js';
const GL = WebGLRenderingContext;
function gpuBufferUsageForTarget(target) {
    switch (target) {
        case GL.ARRAY_BUFFER: return GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE;
        case GL.ELEMENT_ARRAY_BUFFER: return GPUBufferUsage.INDEX;
    }
}
export class CreateWebGpuBuffers extends WebGpuGltfTransform {
    static Dependencies = [SetDefaults];
    transform(gltf, buffers, images) {
        // Create WebGPU buffers for every bufferView that contains vertex or index data.
        const promises = [];
        for (const bufferView of buffers.bufferViews) {
            if (!bufferView.target) {
                continue;
            }
            const gpuBuffer = this.device.createBuffer({
                label: bufferView.name,
                // Round the buffer size up to the nearest multiple of 4.
                size: Math.ceil(bufferView.byteLength / 4) * 4,
                usage: gpuBufferUsageForTarget(bufferView.target),
                mappedAtCreation: true,
            });
            this.setGpuExtras(bufferView, { buffer: gpuBuffer });
            // Wait for the buffer contents to resolve, then populate the gpuBuffer with it's values.
            promises.push(bufferView.asByteArray().then((byteArray) => {
                const gpuTypedArray = new Uint8Array(gpuBuffer.getMappedRange());
                gpuTypedArray.set(byteArray);
                gpuBuffer.unmap();
                return gpuBuffer;
            }));
        }
        return Promise.all(promises);
    }
}
//# sourceMappingURL=create-webgpu-buffers.js.map