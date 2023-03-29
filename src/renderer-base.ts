import { GeometryLayout, GeometryLayoutCache } from './geometry/geometry-layout.js';

export class RendererBase {
  #geometryLayoutCache: GeometryLayoutCache = new GeometryLayoutCache();

  constructor(public device: GPUDevice) {}

  createGeometryLayout(attribBuffers: GPUVertexBufferLayout[],
                       topology: GPUPrimitiveTopology,
                       indexFormat: GPUIndexFormat = 'uint32'): Readonly<GeometryLayout> {
    return this.#geometryLayoutCache.createLayout(attribBuffers, topology, indexFormat);
  }
}