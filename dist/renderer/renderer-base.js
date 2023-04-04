import { RenderGeometryManager } from './render-geometry.js';
import { RenderLightManager } from './render-light.js';
import { RenderMaterialManager } from './render-material.js';
export class RendererBase {
    device;
    renderGeometryManager;
    renderMaterialManager;
    renderLightManager;
    constructor(device) {
        this.device = device;
        this.renderGeometryManager = new RenderGeometryManager(device);
        this.renderMaterialManager = new RenderMaterialManager(device);
        this.renderLightManager = new RenderLightManager(device);
    }
    createGeometry(desc) {
        return this.renderGeometryManager.createGeometry(desc);
    }
    createMaterial(desc) {
        return this.renderMaterialManager.createMaterial(desc);
    }
}
//# sourceMappingURL=renderer-base.js.map