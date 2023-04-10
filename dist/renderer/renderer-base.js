import { RenderSkin } from '../geometry/skin.js';
import { RenderGeometryManager } from './render-geometry.js';
import { RenderLightManager } from './render-light.js';
import { RenderMaterialManager } from './render-material.js';
export class RendererBase {
    device;
    renderGeometryManager;
    renderMaterialManager;
    renderLightManager;
    skinBindGroupLayout;
    constructor(device) {
        this.device = device;
        this.renderGeometryManager = new RenderGeometryManager(device);
        this.renderMaterialManager = new RenderMaterialManager(device);
        this.renderLightManager = new RenderLightManager(device);
        this.skinBindGroupLayout = device.createBindGroupLayout({
            label: 'skin bind group layout',
            entries: [{
                    binding: 0,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.VERTEX
                }, {
                    binding: 1,
                    buffer: { type: 'read-only-storage' },
                    visibility: GPUShaderStage.VERTEX
                }]
        });
    }
    createGeometry(desc) {
        return this.renderGeometryManager.createGeometry(desc);
    }
    createMaterial(desc) {
        return this.renderMaterialManager.createMaterial(desc);
    }
    createSkin(desc) {
        let invBindMatrixCount = desc.inverseBindMatrices.length;
        if (desc.inverseBindMatrices instanceof Float32Array) {
            invBindMatrixCount = desc.inverseBindMatrices.length / 16;
        }
        // Create an fill the inverse bind matrix buffer.
        const invBindBuffer = this.device.createBuffer({
            label: 'skin inverse bind matrix buffer',
            size: invBindMatrixCount * 16 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        const invBindArray = new Float32Array(invBindBuffer.getMappedRange());
        if (desc.inverseBindMatrices instanceof Float32Array) {
            invBindArray.set(desc.inverseBindMatrices);
        }
        else {
            for (const [index, invBindMatrix] of desc.inverseBindMatrices.entries()) {
                invBindArray.set(invBindMatrix, index * 16);
            }
        }
        invBindBuffer.unmap();
        const jointBuffer = this.device.createBuffer({
            label: 'skin joint buffer',
            size: desc.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        // Create a bind group for both the inverse bind matrix buffer and the joint buffer.
        const skinBindGroup = this.device.createBindGroup({
            label: 'skin bind group',
            layout: this.skinBindGroupLayout,
            entries: [{
                    binding: 0,
                    resource: { buffer: invBindBuffer },
                }, {
                    binding: 1,
                    resource: { buffer: jointBuffer },
                }]
        });
        return new RenderSkin(this, skinBindGroup, desc.joints, invBindBuffer, jointBuffer);
    }
    cloneSkin(skin) {
        const jointBuffer = this.device.createBuffer({
            label: 'skin joint buffer',
            size: skin.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const skinBindGroup = this.device.createBindGroup({
            label: 'skin bind group',
            layout: this.skinBindGroupLayout,
            entries: [{
                    binding: 0,
                    resource: { buffer: skin.invBindBuffer },
                }, {
                    binding: 1,
                    resource: { buffer: jointBuffer },
                }]
        });
        return new RenderSkin(this, skinBindGroup, skin.joints, skin.invBindBuffer, jointBuffer);
    }
}
//# sourceMappingURL=renderer-base.js.map