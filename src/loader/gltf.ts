import { Mat4 } from '../../../gl-matrix/dist/src/mat4.js';
import { WebGpuGltfLoader } from '../../../hoard-gpu/dist/gltf/webgpu-gltf-loader.js'
import { WebGpuTextureLoader } from '../../../hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js'
import { ComputeAABB } from '../../../hoard-gpu/dist/gltf/transforms/compute-aabb.js'
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
    this.#hoardLoader = new WebGpuGltfLoader(renderer.device, [ComputeAABB]);
  }

  get textureLoader(): WebGpuTextureLoader {
    return this.#hoardLoader.textureLoader;
  }

  async loadFromUrl(url: string): Promise<Scene> {
    const gltf = await this.#hoardLoader.loadFromUrl(url);

    const renderMaterials: RenderMaterial[] = [];

    function getTexture(textureInfo: any) {
      const index = textureInfo?.index;
      if (index == undefined) {
        return null;
      }

      const texture = gltf.textures[index];
      if (texture.source == undefined) {
        return null;
      }

      const image = gltf.images[texture.source];
      return image.extras?.gpu?.texture;
    }

    for (const material of (gltf.materials as any[])) {
      renderMaterials.push(this.renderer.createMaterial({
        label: material.name,
        baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor,
        baseColorTexture: getTexture(material.pbrMetallicRoughness?.baseColorTexture),
        metallicFactor: material.pbrMetallicRoughness?.metallicFactor,
        roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor,
        metallicRoughnessTexture: getTexture(material.pbrMetallicRoughness?.metallicRoughnessTexture),
        normalTexture: getTexture(material.normalTexture),
        occlusionTexture: getTexture(material.occlusionTexture),
        occlusionStrength: material.occlusionTexture?.strength,
        emissiveFactor: material.emissiveFactor,
        emissiveTexture: getTexture(material.emissiveTexture),
      }));
    }

    const meshes = [];
    for (let i = 0; i < (gltf.meshes as any[]).length; ++i) {
      const mesh = gltf.meshes[i];

      const primitives = [];
      for (const primitive of mesh.primitives) {
        const primitiveDescriptor: Partial<GeometryDescriptor> = {
          label: primitive.name,
          topology: gpuPrimitiveTopologyForMode(primitive.mode),
        };

        for (const [attribName, accessorIndex] of Object.entries(primitive.attributes)) {
          const primitiveAttrib = ATTRIB_MAPPING[attribName];
          if (!primitiveAttrib) {
            console.log(`Skipping unknown attribute ${attribName}`);
            continue;
          }
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

        const renderMesh = {
          geometry: this.renderer.createGeometry(primitiveDescriptor as GeometryDescriptor),
          material: renderMaterials[primitive.material],
        };
        primitives.push(renderMesh);
      }

      meshes.push(primitives);
    }

    const renderScene: Scene = {
      meshes: []
    }

    for (const node of (gltf.nodes as any[])) {
      if (node.mesh !== undefined) {
        const meshPrimitives = meshes[node.mesh];
        for (const primitive of meshPrimitives) {
          renderScene.meshes.push({
            ...primitive,
            transform: node.extras.worldMatrix
          });
        }
      }
    }

    return renderScene;
  }
}