export class CreateWebGpuBuffers extends WebGpuGltfTransform {
    static Dependencies: (typeof SetDefaults)[];
    transform(gltf: any, buffers: any, images: any): Promise<any[]>;
}
import { WebGpuGltfTransform } from "./webgpu-gltf-transform.js";
import { SetDefaults } from "../set-defaults.js";
