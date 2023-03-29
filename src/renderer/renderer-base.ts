import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
import { RendererGeometryManager } from './renderer-geometry.js';

export class RendererBase {
  #renderGeometryManager: RendererGeometryManager = new RendererGeometryManager();

  constructor(public device: GPUDevice) {
  }

  createGeometry(desc: GeometryDescriptor): RenderGeometry {
    return this.#renderGeometryManager.createGeometry(this.device, desc);
  }
}