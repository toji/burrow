import { Mat4 } from '../../../gl-matrix/dist/src/mat4.js';
import { WebGpuGltfLoader } from '../../../hoard-gpu/dist/gltf/webgpu-gltf-loader.js'
import { GeometryDescriptor } from '../geometry/geometry.js';
import { RenderMaterial } from '../material/material.js';
import { DeferredRenderer, Scene, SceneMesh } from '../renderer/deferred-renderer.js';

const GL = WebGLRenderingContext;

function gpuFormatForAccessor(accessor): GPUVertexFormat {
  const norm = accessor.normalized ? 'norm' : 'int';
  const count = accessor.extras.componentCount;
  const x = count > 1 ? `x${count}` : '';
  switch (accessor.componentType) {
    case GL.BYTE: return `s${norm}8${x}` as GPUVertexFormat;
    case GL.UNSIGNED_BYTE: return `u${norm}8${x}` as GPUVertexFormat;
    case GL.SHORT: return `s${norm}16${x}` as GPUVertexFormat;
    case GL.UNSIGNED_SHORT: return `u${norm}16${x}` as GPUVertexFormat;
    case GL.UNSIGNED_INT: return `u${norm}32${x}` as GPUVertexFormat;
    case GL.FLOAT: return `float32${x}` as GPUVertexFormat;
  }
}

function gpuIndexFormatForComponentType(componentType): GPUIndexFormat {
  switch (componentType) {
    case GL.UNSIGNED_SHORT: return 'uint16';
    case GL.UNSIGNED_INT: return 'uint32';
    default: return undefined;
  }
}

function gpuPrimitiveTopologyForMode(mode): GPUPrimitiveTopology {
  switch (mode) {
    case GL.TRIANGLES: return 'triangle-list';
    case GL.TRIANGLE_STRIP: return 'triangle-strip';
    case GL.LINES: return 'line-list';
    case GL.LINE_STRIP: return 'line-strip';
    case GL.POINTS: return 'point-list';
  }
}

const ATTRIB_MAPPING = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'texcoord',
  TEXCOORD_1: 'texcoord2',
  COLOR_0: 'color',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
};

export class GltfLoader {
  #hoardLoader: WebGpuGltfLoader;

  constructor(public renderer: DeferredRenderer) {
    this.#hoardLoader = new WebGpuGltfLoader(renderer.device);
  }

  async loadFromUrl(url: string): Promise<Scene> {
    const gltf = await this.#hoardLoader.loadFromUrl(url);

    const renderMaterials: RenderMaterial[] = [];

    for (const material of (gltf.materials as any[])) {
      renderMaterials.push(this.renderer.createMaterial({
        label: material.name,

      }));
    }

    const renderScene: Scene = {
      meshes: []
    }

    for (let i = 0; i < (gltf.meshes as any[]).length; ++i) {
      const mesh = gltf.meshes[i];

      const renderMesh: SceneMesh = {
        transform: new Mat4(),
        geometry: [],
      };
      for (const primitive of mesh.primitives) {
        const primitiveDescriptor: Partial<GeometryDescriptor> = {
          label: primitive.name,
          topology: gpuPrimitiveTopologyForMode(primitive.mode),
        };

        for (const [attribName, accessorIndex] of Object.entries(primitive.attributes)) {
          const primitiveAttrib = ATTRIB_MAPPING[attribName];
          const accessor = gltf.accessors[accessorIndex as number];
          const bufferView = gltf.bufferViews[accessor.bufferView];

          primitiveDescriptor[primitiveAttrib] = {
            values: bufferView.extras.gpu.buffer,
            offset: accessor.byteOffset,
            stride: bufferView.byteStride || accessor.extras.packedByteStride,
            format: gpuFormatForAccessor(accessor),
          };

          primitiveDescriptor.drawCount = accessor.count;
        }

        if ('indices' in primitive) {
          const accessor = gltf.accessors[primitive.indices];
          const bufferView = gltf.bufferViews[accessor.bufferView];
          primitiveDescriptor.indices = {
            values: bufferView.extras.gpu.buffer,
            offset: accessor.byteOffset,
            format: gpuIndexFormatForComponentType(accessor.componentType),
          };
          primitiveDescriptor.drawCount = accessor.count;
        }

        renderMesh.geometry.push(this.renderer.createGeometry(primitiveDescriptor as GeometryDescriptor));
      }

      renderScene.meshes.push(renderMesh);
    }

    return renderScene;
  }
}