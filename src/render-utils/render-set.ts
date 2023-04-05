import { Mat4 } from "../../third-party/gl-matrix/dist/src/index.js";
import { GeometryLayout } from "../geometry/geometry-layout.js";
import { RenderGeometry } from "../geometry/geometry.js";
import { RenderMaterial } from "../material/material.js";
import { SceneMesh } from "../renderer/deferred-renderer.js";

const INITIAL_INSTANCE_COUNT = 1024;
const INSTANCE_SIZE = 64;

interface GeometryInstances {
  firstInstance: number,
  instanceCount: number,
  transforms: Mat4[],
}

export type InstancedGeometry = Map<RenderGeometry, GeometryInstances>;
export type MaterialGeometry = Map<RenderMaterial, InstancedGeometry>;
export type PipelineMaterials = Map<GPURenderPipeline, MaterialGeometry>;

export interface RenderSet {
  totalInstanceCount: number;
  pipelineMaterials: PipelineMaterials;
  instanceBindGroup: GPUBindGroup;
}

export abstract class RenderSetProvider {
  instanceBindGroupLayout: GPUBindGroupLayout;
  instanceBindGroup: GPUBindGroup;
  instanceArray: Float32Array;
  instanceBuffer: GPUBuffer;

  #pipelineCache: Map<string, GPURenderPipeline> = new Map();

  constructor(public device: GPUDevice, public defaultMaterial: RenderMaterial) {
    this.instanceBindGroupLayout = device.createBindGroupLayout({
      label: 'instance bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' }
      }]
    });

    this.#reallocateInstanceBuffer(INITIAL_INSTANCE_COUNT * INSTANCE_SIZE);
  }

  #reallocateInstanceBuffer(byteSize: number) {
    this.instanceArray = new Float32Array(byteSize / Float32Array.BYTES_PER_ELEMENT);
    this.instanceBuffer = this.device.createBuffer({
      label: 'instance transform storage buffer',
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.instanceBindGroup = this.device.createBindGroup({
      label: 'instance bind group',
      layout: this.instanceBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.instanceBuffer }
      }]
    });
  }

  #getOrCreatePipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial): GPURenderPipeline {
    const key = this.getKey(layout, material);
    let pipeline = this.#pipelineCache.get(key);
    if (pipeline) { return pipeline; }

    pipeline = this.createPipeline(layout, material, key);
    this.#pipelineCache.set(key, pipeline);
    return pipeline;
  }

  getKey(layout: Readonly<GeometryLayout>, material: RenderMaterial): string {
    return `${layout.id};${material.key}`;
  }

  // Indicates whether a mesh should be included in render sets produced by this provider or not.
  meshFilter(mesh: SceneMesh): boolean {
    return true;
  }

  abstract createPipeline(layout: Readonly<GeometryLayout>, material: RenderMaterial, key: string): GPURenderPipeline;

  getRenderSet(meshes: SceneMesh[]): RenderSet {
    const renderSet: RenderSet = {
      totalInstanceCount: 0,
      pipelineMaterials: new Map(),
      instanceBindGroup: this.instanceBindGroup
    };

    const instanceList: GeometryInstances[] = [];

    for (const mesh of meshes) {
      if (!this.meshFilter(mesh)) { continue; }

      const transform = mesh.transform;
      const material = mesh.material ?? this.defaultMaterial;
      const geometry = mesh.geometry;

      const pipeline = this.#getOrCreatePipeline(geometry.layout, material);

      let materialGeometries = renderSet.pipelineMaterials.get(pipeline);
      if (!materialGeometries) {
        materialGeometries = new Map();
        renderSet.pipelineMaterials.set(pipeline, materialGeometries);
      }

      let geometryInstances = materialGeometries.get(material);
      if (!geometryInstances) {
        geometryInstances = new Map();
        materialGeometries.set(material, geometryInstances);
      }

      let instances = geometryInstances.get(geometry);
      if (!instances) {
        instances = {
          firstInstance: -1,
          instanceCount: -1,
          transforms: []
        };
        geometryInstances.set(geometry, instances);
        instanceList.push(instances);
      }
      instances.transforms.push(transform);
      renderSet.totalInstanceCount++;
    }

    const instanceByteSize = renderSet.totalInstanceCount * Float32Array.BYTES_PER_ELEMENT * 16;

    // Resize the buffer if needed.
    if (instanceByteSize > this.instanceBuffer.size) {
      let newSize = this.instanceBuffer.size * 2;
      while (newSize < instanceByteSize) {
        newSize *= 2;
      }
      this.#reallocateInstanceBuffer(newSize);
    }

    // Update the instance buffer
    // TODO: Handle this with a pool of mapped buffers?
    let instanceOffset = 0;
    for (const instances of instanceList) {
      instances.firstInstance = instanceOffset;
      instances.instanceCount = instances.transforms.length;
      for (const transform of instances.transforms) {
        this.instanceArray.set(transform, instanceOffset * 16);
        instanceOffset++;
      }
    }
    this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceArray);

    return renderSet;
  }
}