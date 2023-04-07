import { WebGpuGltfTransform } from './webgpu-gltf-transform.js';
import { CreateWebGpuBuffers } from './create-webgpu-buffers.js';
const GL = WebGLRenderingContext;
function getMaterialType(material) {
    if (material?.extensions?.KHR_materials_unlit) {
        return 'KHR_materials_unlit';
    }
    if (material?.extensions?.KHR_materials_pbrSpecularGlossiness) {
        return 'KHR_materials_pbrSpecularGlossiness';
    }
    return 'pbrMetallicRoughness';
}
function gpuFormatForAccessor(accessor) {
    const norm = accessor.normalized ? 'norm' : 'int';
    const count = accessor.extras.componentCount;
    const x = count > 1 ? `x${count}` : '';
    switch (accessor.componentType) {
        case GL.BYTE: return `s${norm}8${x}`;
        case GL.UNSIGNED_BYTE: return `u${norm}8${x}`;
        case GL.SHORT: return `s${norm}16${x}`;
        case GL.UNSIGNED_SHORT: return `u${norm}16${x}`;
        case GL.UNSIGNED_INT: return `u${norm}32${x}`;
        case GL.FLOAT: return `float32${x}`;
    }
}
function gpuIndexFormatForComponentType(componentType) {
    switch (componentType) {
        case GL.UNSIGNED_SHORT: return 'uint16';
        case GL.UNSIGNED_INT: return 'uint32';
        default: return undefined;
    }
}
function gpuPrimitiveTopologyForMode(mode) {
    switch (mode) {
        case GL.TRIANGLES: return 'triangle-list';
        case GL.TRIANGLE_STRIP: return 'triangle-strip';
        case GL.LINES: return 'line-list';
        case GL.LINE_STRIP: return 'line-strip';
        case GL.POINTS: return 'point-list';
    }
}
export class ResolveWebGpuPipelines extends WebGpuGltfTransform {
    static Dependencies = [
        CreateWebGpuBuffers,
    ];
    globalPipelineCache = new Map();
    globalPipelineIndex = 0;
    attributeLocations;
    constructor(loaderOptions) {
        super(loaderOptions);
        this.attributeLocations = loaderOptions.attributeLocations;
        if (!this.attributeLocations) {
            throw new Error('attributeLocations must be specified as part of the loaderOptions when using the ResolveWebGpuPipelines transform.');
        }
    }
    setupPrimitive(gltf, primitive, buffers) {
        const bufferLayout = new Map();
        const gpuBuffers = new Map();
        let drawCount = 0;
        const shaderLocations = {};
        for (const [attribName, accessorIndex] of Object.entries(primitive.attributes)) {
            const shaderLocation = this.attributeLocations[attribName];
            if (shaderLocation === undefined) {
                continue;
            }
            shaderLocations[attribName] = shaderLocation;
            const accessor = gltf.accessors[accessorIndex];
            const offset = accessor.byteOffset;
            const bufferView = buffers.getBufferView(accessor.bufferView);
            let buffer = bufferLayout.get(accessor.bufferView);
            let gpuBuffer;
            let separate = buffer && (Math.abs(offset - buffer.attributes[0].offset) >= buffer.arrayStride);
            if (!buffer || separate) {
                buffer = {
                    arrayStride: bufferView.byteStride || accessor.extras.packedByteStride,
                    attributes: [],
                };
                bufferLayout.set(separate ? attribName : accessor.bufferView, buffer);
                gpuBuffers.set(buffer, {
                    buffer: bufferView.extras.gpu.buffer,
                    offset
                });
            }
            else {
                gpuBuffer = gpuBuffers.get(buffer);
                gpuBuffer.offset = Math.min(gpuBuffer.offset, offset);
            }
            buffer.attributes.push({
                shaderLocation,
                format: gpuFormatForAccessor(accessor),
                offset,
            });
            drawCount = accessor.count;
        }
        for (const buffer of bufferLayout.values()) {
            const gpuBuffer = gpuBuffers.get(buffer);
            // Adjust the attribute offsets to take into account the buffer offset.
            for (const attribute of buffer.attributes) {
                attribute.offset -= gpuBuffer.offset;
            }
            // Sort the attributes by shader location.
            buffer.attributes = buffer.attributes.sort((a, b) => {
                return a.shaderLocation - b.shaderLocation;
            });
        }
        // Sort the buffers by their first attribute's shader location.
        const sortedBufferLayout = [...bufferLayout.values()].sort((a, b) => {
            return a.attributes[0].shaderLocation - b.attributes[0].shaderLocation;
        });
        // Ensure that the gpuBuffers are saved in the same order as the buffer layout.
        const sortedGpuBuffers = [];
        for (const buffer of sortedBufferLayout) {
            sortedGpuBuffers.push(gpuBuffers.get(buffer));
        }
        const drawArgs = {
            buffers: sortedGpuBuffers,
            drawCount,
        };
        if ('indices' in primitive) {
            const accessor = gltf.accessors[primitive.indices];
            drawArgs.indexBuffer = buffers.getBufferView(accessor.bufferView).extras.gpu.buffer;
            drawArgs.indexOffset = accessor.byteOffset;
            drawArgs.indexType = gpuIndexFormatForComponentType(accessor.componentType);
            drawArgs.drawCount = accessor.count;
        }
        const material = gltf.materials[primitive.material];
        const pipeline = this.resolvePipeline(sortedBufferLayout, shaderLocations, primitive, material);
        drawArgs.pipeline = gltf.extras.gpu.pipelines.findIndex((element) => element.key == pipeline.key);
        if (drawArgs.pipeline === -1) {
            drawArgs.pipeline = gltf.extras.gpu.pipelines.length;
            gltf.extras.gpu.pipelines.push(pipeline);
        }
        this.setGpuExtras(primitive, drawArgs);
    }
    resolvePipeline(buffers, shaderLocations, primitive, material) {
        const materialType = getMaterialType(material);
        const pipelineKey = JSON.stringify({
            buffers,
            topology: primitive.mode,
            materialType,
            cullMode: material.doubleSided,
            alphaMode: material.alphaMode,
        });
        let pipeline = this.globalPipelineCache.get(pipelineKey);
        if (!pipeline) {
            let blend = undefined;
            if (material.alphaMode == 'BLEND') {
                blend = {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one',
                    }
                };
            }
            pipeline = {
                key: this.globalPipelineIndex++,
                materialType,
                alphaMode: material.alphaMode,
                shaderLocations,
                vertex: {
                    buffers
                },
                primitive: {
                    topology: gpuPrimitiveTopologyForMode(primitive.mode),
                    cullMode: material.doubleSided ? 'none' : 'back'
                },
                blend
            };
            this.globalPipelineCache.set(pipelineKey, pipeline);
        }
        return pipeline;
    }
    async transform(gltf, buffers, images, options, transformResults) {
        await transformResults.get(CreateWebGpuBuffers);
        this.setGpuExtras(gltf, { pipelines: [] });
        for (const mesh of gltf.meshes) {
            for (const primitive of mesh.primitives) {
                this.setupPrimitive(gltf, primitive, buffers);
            }
        }
    }
}
//# sourceMappingURL=resolve-webgpu-pipelines.js.map