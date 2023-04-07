import { Vec4, Vec3, Vec2 } from '../../third-party/gl-matrix/dist/src/index.js';
import { RenderMaterial } from '../material/material.js';
// Can reuse these for every PBR material
const MATERIAL_BUFFER_SIZE = 48;
const materialArray = new Float32Array(MATERIAL_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
const baseColorFactor = new Vec4(materialArray.buffer, 0);
const emissiveFactor = new Vec3(materialArray.buffer, 4 * 4);
const metallicRoughnessFactor = new Vec2(materialArray.buffer, 8 * 4);
// TODO: USe the version from Hoard
function createSolidColorTexture(device, r, g, b, a = 1) {
    const data = new Uint8Array([r * 255, g * 255, b * 255, a * 255]);
    const texture = device.createTexture({
        size: { width: 1, height: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture({ texture }, data, {}, { width: 1, height: 1 });
    return texture;
}
export class RenderMaterialManager {
    device;
    materialBindGroupLayout;
    defaultSampler;
    opaqueWhite;
    transparentBlack;
    defaultNormal;
    constructor(device) {
        this.device = device;
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
                    texture: {} // Normal
                }, {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {} // Metallic Roughness
                }, {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {} // Emissive
                }, {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {} // Occlusion
                }]
        });
        this.defaultSampler = device.createSampler({
            label: 'Default PBR Material Sampler',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            addressModeW: 'repeat',
        });
        this.opaqueWhite = createSolidColorTexture(device, 1, 1, 1).createView();
        this.transparentBlack = createSolidColorTexture(device, 0, 0, 0, 0).createView();
        this.defaultNormal = createSolidColorTexture(device, 0.5, 0.5, 1.0, 1).createView();
    }
    createMaterial(desc) {
        Vec4.copy(baseColorFactor, desc.baseColorFactor ?? [1, 1, 1, 1]);
        Vec3.copy(emissiveFactor, desc.emissiveFactor ?? [0, 0, 0]);
        metallicRoughnessFactor.x = desc.metallicFactor ?? 1;
        metallicRoughnessFactor.y = desc.roughnessFactor ?? 1;
        materialArray[10] = desc.occlusionStrength ?? 1;
        materialArray[11] = desc.alphaCutoff ?? 0;
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
                    resource: desc.sampler ?? this.defaultSampler,
                }, {
                    binding: 2,
                    resource: desc.baseColorTexture?.createView() ?? this.opaqueWhite,
                }, {
                    binding: 3,
                    resource: desc.normalTexture?.createView() ?? this.defaultNormal,
                }, {
                    binding: 4,
                    resource: desc.metallicRoughnessTexture?.createView() ?? this.opaqueWhite,
                }, {
                    binding: 5,
                    resource: desc.emissiveTexture?.createView() ?? this.opaqueWhite,
                }, {
                    binding: 6,
                    resource: desc.occlusionTexture?.createView() ?? this.opaqueWhite,
                }]
        });
        return new RenderMaterial(materialBindGroup, desc.transparent ?? false, desc.doubleSided ?? true, (!!desc.alphaCutoff), desc.unlit ?? false);
    }
}
//# sourceMappingURL=render-material.js.map