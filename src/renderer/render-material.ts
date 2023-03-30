import { Vec4, Vec3, Vec2 } from '../../../gl-matrix/dist/src/index.js';
import { PbrMaterialDescriptor, RenderMaterial } from '../material/material.js';

// Can reuse these for every PBR material
const MATERIAL_BUFFER_SIZE = 48;
const materialArray = new Float32Array(MATERIAL_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
const baseColorFactor = new Vec4(materialArray.buffer, 0);
const emissiveFactor = new Vec3(materialArray.buffer, 4 * 4);
const metallicRoughnessFactor = new Vec2(materialArray.buffer, 8 * 4);

export class RenderMaterialManager {
  materialBindGroupLayout: GPUBindGroupLayout;

  constructor(public device: GPUDevice) {
    this.materialBindGroupLayout = device.createBindGroupLayout({
      label: 'PBR Material Bind Group Layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {} // Uniforms
      }, {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Shared Sampler
      }, {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {} // Base Color
      }, {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Normal
      }, {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Metallic Roughness
      }, {
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Emissive
      }, {
        binding: 6,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {} // Occlusion
      }]
    });
  }

  createMaterial(desc: PbrMaterialDescriptor): RenderMaterial {
    Vec4.copy(baseColorFactor, desc.baseColorFactor ?? [1, 1, 1, 1]);
    Vec3.copy(emissiveFactor, desc.emissiveFactor ?? [0, 0, 0]);
    metallicRoughnessFactor.x = desc.metallicFactor ?? 0;
    metallicRoughnessFactor.y = desc.roughnessFactor ?? 0;
    materialArray[7] = desc.occlusionStrength ?? 1;
    materialArray[8] = desc.alphaCutoff ?? 0;

    const materialBuffer = this.device.createBuffer({
      label: `${desc.label} Material Uniform Buffer`,
      size: MATERIAL_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(materialBuffer, 0, materialArray);

    const materialBindGroup = this.device.createBindGroup({
      label: `${desc.label} Material Bind Group`,
      layout: this.materialBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: materialBuffer }
      }, {
        binding: 1,
        resource: desc.sampler,
      }, {
        binding: 2,
        resource: desc.baseColorTexture.createView(),
      }, {
        binding: 3,
        resource: desc.normalTexture.createView(),
      }, {
        binding: 4,
        resource: desc.metallicRoughnessTexture.createView(),
      }, {
        binding: 5,
        resource: desc.emissiveTexture.createView(),
      }, {
        binding: 6,
        resource: desc.occlusionTexture.createView(),
      }]
    });

    return new RenderMaterial(
      materialBindGroup,
      desc.transparent ?? false,
      desc.doubleSided ?? true,
      (!!desc.alphaCutoff)
    );
  }
}