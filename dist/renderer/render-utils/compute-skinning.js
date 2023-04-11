// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';
import { AttributeLocation } from "../../geometry/geometry.js";
import { DefaultStride } from "../render-geometry.js";
import { skinningFunctions } from "../shaders/common.js";
const WORKGROUP_SIZE = 64;
function getSkinningShader(layout) {
    const is16BitJoints = layout.getLocationDesc(AttributeLocation.joints).format === 'uint16x4';
    return wgsl `
  struct SkinnedVertexOutputs {
    position: vec4f,
#if ${layout.locationsUsed.has(AttributeLocation.normal)}
    normal: vec4f,
#endif
#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
    tangent: vec4f,
#endif
  };
  @group(0) @binding(0) var<storage, read_write> outVerts : array<SkinnedVertexOutputs>;

  // TODO: These should come from a uniform
  override jointStride: u32 = 1;
  override weightStride: u32 = 4;
  override positionStride: u32 = 3;
  override normalStride: u32 = 3;
  override tangentStride: u32 = 4;

  struct OffsetValues {
    vertexCount: u32,
    joint: u32,
    weight: u32,
    position: u32,
    normal: u32,
    tangent: u32
  };

  @group(0) @binding(1) var<uniform> offsets: OffsetValues;

  @group(0) @binding(2) var<storage> inJoints: array<u32>;
  @group(0) @binding(3) var<storage> inWeights: array<f32>;
  @group(0) @binding(4) var<storage> inPosition: array<f32>;
#if ${layout.locationsUsed.has(AttributeLocation.normal)}
  @group(0) @binding(5) var<storage> inNormal: array<f32>;
#endif
#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
  @group(0) @binding(6) var<storage> inTangent: array<f32>;
#endif
  

  ${skinningFunctions}
  @group(1) @binding(0) var<storage> invBindMat: array<mat4x4f>;
  @group(1) @binding(1) var<storage> jointMat: array<mat4x4f>;

  @compute @workgroup_size(64)
  fn computeMain(@builtin(global_invocation_id) globalId : vec3u) {
    let i = globalId.x;
    if (i >= offsets.vertexCount) { return; }

#if ${is16BitJoints}
    let packedJoints0 = inJoints[i * jointStride + offsets.joint];
    let joint0 = (packedJoints0 & 0xFFFF);
    let joint1 = (packedJoints0 & 0xFFFF0000) >> 16;
    let packedJoints1 = inJoints[i * jointStride + offsets.joint + 1];
    let joint2 = (packedJoints1 & 0xFFFF);
    let joint3 = (packedJoints1 & 0xFFFF0000) >> 16;
#else
    let packedJoints = inJoints[i * jointStride + offsets.joint];
    let joint0 = (packedJoints & 0xFF);
    let joint1 = (packedJoints & 0xFF00) >> 8;
    let joint2 = (packedJoints & 0xFF0000) >> 16;
    let joint3 = (packedJoints & 0xFF000000) >> 24;
#endif
    let joints = vec4u(joint0, joint1, joint2, joint3);

    let wo = i * weightStride + offsets.weight;
    let weights = vec4f(inWeights[wo], inWeights[wo + 1], inWeights[wo + 2], inWeights[wo + 3]);

    let skinMatrix = getSkinMatrix(joints, weights);

    let po = i * positionStride + offsets.position;
    let pos = vec4f(inPosition[po], inPosition[po + 1], inPosition[po + 2], 1);
    outVerts[i].position = vec4f((skinMatrix * pos).xyz, 1);

#if ${layout.locationsUsed.has(AttributeLocation.normal)}
    let no = i * normalStride + offsets.normal;
    let normal = vec4f(inNormal[no], inNormal[no + 1], inNormal[no + 2], 0);
    outVerts[i].normal = vec4f(normalize((skinMatrix * normal).xyz), 0);
#endif

#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
    let to = i * tangentStride + offsets.tangent;
    let tangent = vec4f(inTangent[to], inTangent[to + 1], inTangent[to + 2], inTangent[to + 3]);
    outVerts[i].tangent = vec4(normalize((skinMatrix * vec4f(tangent.xyz, 1)).xyz), tangent.w);
#endif
  }
`;
}
function getAttributeSize(desc) {
    if (!desc) {
        return 0;
    }
    return DefaultStride[desc.format];
}
export class ComputeSkinningManager {
    renderer;
    #skinnedGeometry = new WeakMap();
    #skinningPipelines = new Map();
    constructor(renderer) {
        this.renderer = renderer;
    }
    #getSkinningPipeline(layout) {
        const key = layout.id;
        let pipeline = this.#skinningPipelines.get(key);
        if (!pipeline) {
            const entries = [{
                    binding: 0,
                    buffer: { type: 'storage' },
                    visibility: GPUShaderStage.COMPUTE
                }, {
                    binding: 1,
                    buffer: {},
                    visibility: GPUShaderStage.COMPUTE
                }, {
                    binding: 2,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                }, {
                    binding: 3,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                }, {
                    binding: 4,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                }];
            const getStride = (location) => {
                const desc = layout.getLocationDesc(location);
                if (!desc) {
                    return 0;
                }
                return desc.arrayStride / 4;
            };
            const constants = {
                jointStride: getStride(AttributeLocation.joints),
                weightStride: getStride(AttributeLocation.weights),
                positionStride: getStride(AttributeLocation.position),
            };
            if (layout.locationsUsed.has(AttributeLocation.normal)) {
                entries.push({
                    binding: 5,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                });
                constants.normalStride = getStride(AttributeLocation.normal);
            }
            if (layout.locationsUsed.has(AttributeLocation.tangent)) {
                entries.push({
                    binding: 6,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                });
                constants.tangentStride = getStride(AttributeLocation.tangent);
            }
            const bindGroupLayout = this.renderer.device.createBindGroupLayout({
                label: 'compute skinning bind group layout',
                entries
            });
            const module = this.renderer.device.createShaderModule({
                label: `compute skinning shader module (layout: ${key})`,
                code: getSkinningShader(layout)
            });
            pipeline = this.renderer.device.createComputePipeline({
                label: `compute skinning pipeline (layout: ${key})`,
                layout: this.renderer.device.createPipelineLayout({ bindGroupLayouts: [
                        bindGroupLayout,
                        this.renderer.skinBindGroupLayout,
                    ] }),
                compute: {
                    module,
                    entryPoint: 'computeMain',
                    constants,
                }
            });
            this.#skinningPipelines.set(key, pipeline);
        }
        return pipeline;
    }
    #getSkinnedGeometry(geometry) {
        let skinned = this.#skinnedGeometry.get(geometry);
        if (!skinned) {
            const hasNormal = geometry.layout.locationsUsed.has(AttributeLocation.normal);
            const hasTangent = geometry.layout.locationsUsed.has(AttributeLocation.tangent);
            const skinnedVertexSize = 16 + (hasNormal ? 16 : 0) + (hasTangent ? 16 : 0);
            let skinnedBuffer = this.renderer.device.createBuffer({
                size: skinnedVertexSize * geometry.vertexCount,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
            });
            let skinnedGeometryDesc = {
                position: { values: skinnedBuffer, offset: 0, stride: skinnedVertexSize },
                drawCount: geometry.drawCount,
                topology: geometry.layout.topology
            };
            let skinnedOffset = 16;
            if (hasNormal) {
                skinnedGeometryDesc.normal = {
                    values: skinnedBuffer, offset: skinnedOffset, stride: skinnedVertexSize
                };
                skinnedOffset += 16;
            }
            if (hasTangent) {
                skinnedGeometryDesc.tangent = {
                    values: skinnedBuffer, offset: skinnedOffset, stride: skinnedVertexSize
                };
                skinnedOffset += 16;
            }
            for (let location of geometry.layout.locationsUsed) {
                switch (location) {
                    case AttributeLocation.joints:
                    case AttributeLocation.weights:
                    case AttributeLocation.position:
                    case AttributeLocation.normal:
                    case AttributeLocation.tangent:
                        continue;
                    default: {
                        const desc = geometry.layout.getLocationDesc(location);
                        const vertexBuffer = geometry.vertexBuffers[desc.bufferIndex];
                        skinnedGeometryDesc[AttributeLocation[location]] = {
                            values: vertexBuffer.buffer,
                            stride: desc.arrayStride,
                            offset: vertexBuffer.offset + desc.offset,
                            format: desc.format
                        };
                    }
                }
            }
            if (geometry.indexBuffer) {
                skinnedGeometryDesc.indices = {
                    values: geometry.indexBuffer.buffer,
                    offset: geometry.indexBuffer.offset,
                    format: geometry.indexBuffer.indexFormat
                };
            }
            const renderGeometry = this.renderer.createGeometry(skinnedGeometryDesc);
            const pipeline = this.#getSkinningPipeline(geometry.layout);
            const jointDesc = geometry.layout.getLocationDesc(AttributeLocation.joints);
            const weightDesc = geometry.layout.getLocationDesc(AttributeLocation.weights);
            const positionDesc = geometry.layout.getLocationDesc(AttributeLocation.position);
            const jointBuffer = geometry.vertexBuffers[jointDesc.bufferIndex];
            const weightBuffer = geometry.vertexBuffers[weightDesc.bufferIndex];
            const positionBuffer = geometry.vertexBuffers[positionDesc.bufferIndex];
            let uniformBuffer = this.renderer.device.createBuffer({
                size: 32,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            });
            const uniformArray = new Uint32Array(uniformBuffer.getMappedRange());
            uniformArray[0] = geometry.vertexCount;
            uniformArray[1] = (jointDesc.offset + jointBuffer.offset) / 4;
            uniformArray[2] = (weightDesc.offset + weightBuffer.offset) / 4;
            uniformArray[3] = (positionDesc.offset + positionBuffer.offset) / 4;
            const entries = [{
                    binding: 0,
                    resource: { buffer: skinnedBuffer }
                }, {
                    binding: 1,
                    resource: { buffer: uniformBuffer }
                }, {
                    binding: 2,
                    resource: { buffer: jointBuffer.buffer }
                }, {
                    binding: 3,
                    resource: { buffer: weightBuffer.buffer }
                }, {
                    binding: 4,
                    resource: { buffer: positionBuffer.buffer }
                }];
            if (hasNormal) {
                const normalDesc = geometry.layout.getLocationDesc(AttributeLocation.normal);
                const normalBuffer = geometry.vertexBuffers[normalDesc.bufferIndex];
                uniformArray[4] = (normalDesc.offset + normalBuffer.offset) / 4;
                entries.push({
                    binding: 5,
                    resource: { buffer: normalBuffer.buffer }
                });
            }
            if (hasTangent) {
                const tangentDesc = geometry.layout.getLocationDesc(AttributeLocation.tangent);
                const tangentBuffer = geometry.vertexBuffers[tangentDesc.bufferIndex];
                uniformArray[5] = (tangentDesc.offset + tangentBuffer.offset) / 4;
                entries.push({
                    binding: 6,
                    resource: { buffer: tangentBuffer.buffer }
                });
            }
            uniformBuffer.unmap();
            const bindGroup = this.renderer.device.createBindGroup({
                label: 'compute skinning bind group',
                layout: pipeline.getBindGroupLayout(0),
                entries
            });
            skinned = {
                geometry: renderGeometry,
                pipeline,
                bindGroup,
            };
            this.#skinnedGeometry.set(geometry, skinned);
        }
        return skinned;
    }
    skinGeometry(computePass, geometry, skin) {
        let skinned = this.#getSkinnedGeometry(geometry);
        computePass.setPipeline(skinned.pipeline);
        computePass.setBindGroup(0, skinned.bindGroup);
        computePass.setBindGroup(1, skin.bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(geometry.vertexCount / WORKGROUP_SIZE));
        return skinned.geometry;
    }
}
//# sourceMappingURL=compute-skinning.js.map