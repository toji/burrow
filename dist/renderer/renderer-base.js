import { RenderGeometryManager } from './render-geometry.js';
import { RenderMaterialManager } from './render-material.js';
export class RendererBase {
    device;
    renderGeometryManager;
    renderMaterialManager;
    constructor(device) {
        this.device = device;
        this.renderGeometryManager = new RenderGeometryManager(device);
        this.renderMaterialManager = new RenderMaterialManager(device);
    }
    createGeometry(desc) {
        return this.renderGeometryManager.createGeometry(desc);
    }
    createMaterial(desc) {
        return this.renderMaterialManager.createMaterial(desc);
    }
}
//# sourceMappingURL=renderer-base.js.map