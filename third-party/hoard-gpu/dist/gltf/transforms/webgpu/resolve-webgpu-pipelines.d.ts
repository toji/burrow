import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { CreateWebGpuBuffers } from './create-webgpu-buffers.js';
import { GlTf, MeshPrimitive } from '../../gltf.js';
import { BufferManager } from '../../buffer-manager.js';
import { ImageManager } from '../../image-manager.js';
export declare class ResolveWebGpuPipelines extends WebGpuGltfTransform {
    static Dependencies: (typeof CreateWebGpuBuffers)[];
    globalPipelineCache: Map<any, any>;
    globalPipelineIndex: number;
    attributeLocations: {
        [x: string]: number;
    };
    constructor(loaderOptions: any);
    setupPrimitive(gltf: GlTf, primitive: MeshPrimitive, buffers: BufferManager): void;
    resolvePipeline(buffers: any, shaderLocations: any, primitive: any, material: any): any;
    transform(gltf: GlTf, buffers: BufferManager, images: ImageManager, options: any, transformResults: any): Promise<void>;
}
