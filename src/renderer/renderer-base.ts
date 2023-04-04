import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
import { PbrMaterialDescriptor, RenderMaterial } from '../material/material.js';
import { RenderGeometryManager } from './render-geometry.js';
import { RenderLightManager } from './render-light.js';
import { RenderMaterialManager } from './render-material.js';

export class RendererBase {
  renderGeometryManager: RenderGeometryManager;
  renderMaterialManager: RenderMaterialManager;
  renderLightManager: RenderLightManager;

  constructor(public device: GPUDevice) {
    this.renderGeometryManager = new RenderGeometryManager(device);
    this.renderMaterialManager = new RenderMaterialManager(device);
    this.renderLightManager = new RenderLightManager(device);
  }

  createGeometry(desc: GeometryDescriptor): RenderGeometry {
    return this.renderGeometryManager.createGeometry(desc);
  }

  createMaterial(desc: PbrMaterialDescriptor): RenderMaterial {
    return this.renderMaterialManager.createMaterial(desc);
  }
}