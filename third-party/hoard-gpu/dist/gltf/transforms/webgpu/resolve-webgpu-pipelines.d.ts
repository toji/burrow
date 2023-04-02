export class ResolveWebGpuPipelines extends WebGpuGltfTransform {
    static Dependencies: (typeof CreateWebGpuBuffers)[];
    constructor(loaderOptions: any);
    globalPipelineCache: Map<any, any>;
    globalPipelineIndex: number;
    attributeLocations: any;
    setupPrimitive(gltf: any, primitive: any, buffers: any): void;
    resolvePipeline(buffers: any, shaderLocations: any, primitive: any, material: any): any;
    transform(gltf: any, buffers: any, images: any, options: any, transformResults: any): Promise<void>;
}
import { WebGpuGltfTransform } from "./webgpu-gltf-transform.js";
import { CreateWebGpuBuffers } from "./create-webgpu-buffers.js";
