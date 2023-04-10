import { AttributeLocation } from "../../geometry/geometry.js";
import { DefaultStride } from "../render-geometry.js";
import { skinningFunctions } from "../shaders/common.js";
const WORKGROUP_SIZE = 64;
const SKINNING_SHADER = /*wgsl*/ `
  struct SkinnedVertexOutputs {
    position: vec4f,
    normal: vec4f,
    tangent: vec4f,
  };
  @group(0) @binding(0) var<storage, read_write> outVerts : array<SkinnedVertexOutputs>;


  // TODO: These should come from a uniform
  const positionStride = 3;
  const normalStride = 3;
  const tangentStride = 4;
  const jointStride = 1;
  const weightStride = 4;

  @group(0) @binding(1) var<storage> inPosition : array<f32>;
  @group(0) @binding(2) var<storage> inNormal : array<f32>;
  @group(0) @binding(3) var<storage> inTangent : array<f32>;
  @group(0) @binding(4) var<storage> inJoints : array<u32>;
  @group(0) @binding(5) var<storage> inWeights : array<f32>;

  ${skinningFunctions}
  @group(1) @binding(0) var<storage> invBindMat : array<mat4x4f>;
  @group(1) @binding(1) var<storage> jointMat : array<mat4x4f>;

  @compute @workgroup_size(64)
  fn computeMain(@builtin(global_invocation_id) globalId : vec3u) {
    let i = globalId.x;

    let pos = vec4f(inPosition[i * positionStride], inPosition[i * positionStride + 1], inPosition[i * positionStride + 2], 1);
    let normal = vec4f(inNormal[i * normalStride], inNormal[i * normalStride + 1], inNormal[i * normalStride + 2], 0);
    let tangent = vec4f(inTangent[i * tangentStride], inTangent[i * tangentStride + 1], inTangent[i * tangentStride + 2], inTangent[i * tangentStride + 3]);

    let packedJoints = inJoints[i * jointStride];
    let joint0 = (packedJoints & 0xFF);
    let joint1 = (packedJoints & 0xFF00) >> 8;
    let joint2 = (packedJoints & 0xFF0000) >> 16;
    let joint3 = (packedJoints & 0xFF000000) >> 24;
    let joints = vec4u(joint0, joint1, joint2, joint3);
    let weights = vec4f(inWeights[i * weightStride], inWeights[i * weightStride + 1], inWeights[i * weightStride + 2], inWeights[i * weightStride + 3]);

    //outVerts[i].position = pos;
    outVerts[i].normal = normal;
    outVerts[i].tangent = tangent;

    let skinMatrix = getSkinMatrix(joints, weights);
    outVerts[i].position = vec4f((skinMatrix * pos).xyz, 1);
    outVerts[i].normal = vec4f(normalize((skinMatrix * normal).xyz), 0);
    outVerts[i].tangent = vec4(normalize((skinMatrix * vec4f(tangent.xyz, 1)).xyz), tangent.w);
  }
`;
function getAttributeSize(desc) {
    if (!desc) {
        return 0;
    }
    return DefaultStride[desc.format];
}
export class ComputeSkinningManager {
    renderer;
    #bindGroupLayout;
    #skinnedGeometry = new WeakMap();
    #skinningPipelines = new Map();
    constructor(renderer) {
        this.renderer = renderer;
        this.#bindGroupLayout = renderer.device.createBindGroupLayout({
            label: 'compute skinning bind group layout',
            entries: [{
                    binding: 0,
                    buffer: { type: 'storage' },
                    visibility: GPUShaderStage.COMPUTE
                }, {
                    binding: 1,
                    buffer: { type: 'read-only-storage' },
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
                }, {
                    binding: 5,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.COMPUTE
                }]
        });
    }
    #getSkinningPipeline(inputGeometry) {
        const key = inputGeometry.layout.id;
        let pipeline = this.#skinningPipelines.get(key);
        if (!pipeline) {
            const module = this.renderer.device.createShaderModule({
                label: `compute skinning shader module (layout: ${key})`,
                code: SKINNING_SHADER
            });
            pipeline = this.renderer.device.createComputePipeline({
                label: `compute skinning pipeline (layout: ${key})`,
                layout: this.renderer.device.createPipelineLayout({ bindGroupLayouts: [
                        this.#bindGroupLayout,
                        this.renderer.skinBindGroupLayout,
                    ] }),
                compute: {
                    module,
                    entryPoint: 'computeMain',
                }
            });
            this.#skinningPipelines.set(key, pipeline);
        }
        return pipeline;
    }
    #getSkinnedGeometry(geometry) {
        let skinned = this.#skinnedGeometry.get(geometry);
        if (!skinned) {
            let skinnedVertexSize = 48;
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
            if (geometry.layout.locationsUsed.has(AttributeLocation.normal)) {
                skinnedGeometryDesc.normal = {
                    values: skinnedBuffer, offset: skinnedOffset, stride: skinnedVertexSize
                };
                skinnedOffset += 16;
            }
            if (geometry.layout.locationsUsed.has(AttributeLocation.tangent)) {
                skinnedGeometryDesc.tangent = {
                    values: skinnedBuffer, offset: skinnedOffset, stride: skinnedVertexSize
                };
                skinnedOffset += 16;
            }
            for (let location of geometry.layout.locationsUsed) {
                switch (location) {
                    case AttributeLocation.position:
                    case AttributeLocation.normal:
                    case AttributeLocation.tangent:
                    case AttributeLocation.weights:
                    case AttributeLocation.joints:
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
            const pipeline = this.#getSkinningPipeline(geometry);
            const positionDesc = geometry.layout.getLocationDesc(AttributeLocation.position);
            const normalDesc = geometry.layout.getLocationDesc(AttributeLocation.normal);
            const tangentDesc = geometry.layout.getLocationDesc(AttributeLocation.tangent);
            const jointDesc = geometry.layout.getLocationDesc(AttributeLocation.joints);
            const weightDesc = geometry.layout.getLocationDesc(AttributeLocation.weights);
            const positionBuffer = geometry.vertexBuffers[positionDesc.bufferIndex];
            const normalBuffer = geometry.vertexBuffers[normalDesc.bufferIndex];
            const tangentBuffer = geometry.vertexBuffers[tangentDesc.bufferIndex];
            const jointBuffer = geometry.vertexBuffers[jointDesc.bufferIndex];
            const weightBuffer = geometry.vertexBuffers[weightDesc.bufferIndex];
            const bindGroup = this.renderer.device.createBindGroup({
                label: 'compute skinning bind group',
                layout: pipeline.getBindGroupLayout(0),
                entries: [{
                        binding: 0,
                        resource: { buffer: skinnedBuffer }
                    }, {
                        binding: 1,
                        resource: { buffer: positionBuffer.buffer, offset: positionDesc.offset + positionBuffer.offset }
                    }, {
                        binding: 2,
                        resource: { buffer: normalBuffer.buffer, offset: normalDesc.offset + normalBuffer.offset }
                    }, {
                        binding: 3,
                        resource: { buffer: tangentBuffer.buffer, offset: tangentDesc.offset + tangentBuffer.offset }
                    }, {
                        binding: 4,
                        resource: { buffer: jointBuffer.buffer, offset: jointDesc.offset + jointBuffer.offset }
                    }, {
                        binding: 5,
                        resource: { buffer: weightBuffer.buffer, offset: weightDesc.offset + weightBuffer.offset }
                    }]
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