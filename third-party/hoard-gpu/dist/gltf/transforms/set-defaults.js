import { BufferManager } from '../buffer-manager.js';
import { ImageManager } from '../image-manager.js';
import { GltfTransform } from './gltf-transform.js';
// To make it easier to reference the WebGL enums that glTF uses.
const GL = WebGLRenderingContext;
const DEFAULT_TRANSLATION = [0, 0, 0];
const DEFAULT_ROTATION = [0, 0, 0, 1];
const DEFAULT_SCALE = [1, 1, 1];
function componentCountForType(type) {
    switch (type) {
        case 'SCALAR': return 1;
        case 'VEC2': return 2;
        case 'VEC3': return 3;
        case 'VEC4': return 4;
        default: return 0;
    }
}
function byteSizeForComponentType(componentType) {
    switch (componentType) {
        case GL.BYTE: return 1;
        case GL.UNSIGNED_BYTE: return 1;
        case GL.SHORT: return 2;
        case GL.UNSIGNED_SHORT: return 2;
        case GL.UNSIGNED_INT: return 4;
        case GL.FLOAT: return 4;
        default: return 0;
    }
}
function accessorPackedByeStride(accessor) {
    return byteSizeForComponentType(accessor.componentType) * componentCountForType(accessor.type);
}
// Sets spec-defined defaults for every property
export class SetDefaults extends GltfTransform {
    transform(gltf, buffers, images) {
        // Add empty arrays for some data types if they're missing to make parsing easier.
        gltf.extensionsRequired = gltf.extensionsRequired ?? [];
        gltf.extensionsUsed = gltf.extensionsUsed ?? [];
        gltf.samplers = gltf.samplers ?? [];
        gltf.images = gltf.images ?? [];
        gltf.textures = gltf.textures ?? [];
        gltf.materials = gltf.materials ?? [];
        // Accessor defaults
        for (const accessor of gltf.accessors) {
            accessor.byteOffset = accessor.byteOffset ?? 0;
            accessor.normalized = accessor.normalized ?? false;
            this.setExtras(accessor, {
                componentCount: componentCountForType(accessor.type),
                packedByteStride: accessorPackedByeStride(accessor),
            });
        }
        // Texture defaults
        let defaultSampler = -1;
        for (const texture of gltf.textures) {
            // If any textures use a default sampler, point it at an explicit one to make parsing easier.
            if (texture.sampler === undefined) {
                if (defaultSampler === -1) {
                    defaultSampler = (gltf.samplers).length;
                    gltf.samplers.push({ name: 'Default Sampler' });
                }
                texture.sampler = defaultSampler;
            }
        }
        // Sampler defaults
        for (const sampler of gltf.samplers) {
            sampler.wrapS = sampler.wrapS ?? GL.REPEAT;
            sampler.wrapT = sampler.wrapT ?? GL.REPEAT;
            sampler.magFilter = sampler.magFilter ?? GL.LINEAR;
            sampler.minFilter = sampler.minFilter ?? GL.LINEAR_MIPMAP_LINEAR;
        }
        // Mesh defaults
        let defaultMaterial = -1;
        for (const index in gltf.meshes) {
            const mesh = gltf.meshes[index];
            // Primitives
            for (const primitiveIndex in mesh.primitives) {
                const primitive = mesh.primitives[primitiveIndex];
                // Set the target for each bufferView that's referenced by a primitive attribute.
                for (const accessorIndex of Object.values(primitive.attributes)) {
                    const accessor = gltf.accessors[accessorIndex];
                    if (accessor.bufferView === undefined) {
                        continue;
                    }
                    const bufferView = buffers.getBufferView(accessor.bufferView);
                    if (!bufferView.target) {
                        bufferView.target = GL.ARRAY_BUFFER;
                    }
                }
                // Set the target for each bufferView that's referenced by primitive indices.
                if ('indices' in primitive) {
                    const accessor = gltf.accessors[primitive.indices];
                    if (accessor.bufferView === undefined) {
                        continue;
                    }
                    const bufferView = buffers.getBufferView(accessor.bufferView);
                    if (!bufferView.target) {
                        bufferView.target = GL.ELEMENT_ARRAY_BUFFER;
                    }
                }
                primitive.mode = primitive.mode ?? GL.TRIANGLES;
                // Inject a default material if needed
                if (primitive.material === undefined) {
                    if (defaultMaterial < 0) {
                        defaultMaterial = gltf.materials.length;
                        gltf.materials.push({ name: 'Default Material' });
                    }
                    primitive.material = defaultMaterial;
                }
            }
        }
        // Material defaults
        for (const material of gltf.materials) {
            material.emissiveFactor = material.emissiveFactor ?? [0, 0, 0];
            material.alphaMode = material.alphaMode ?? 'OPAQUE';
            material.alphaCutoff = material.alphaCutoff ?? 0.5;
            material.doubleSided = material.doubleSided ?? false;
            const pbr = material.pbrMetallicRoughness;
            if (pbr) {
                pbr.baseColorFactor = pbr.baseColorFactor ?? [1, 1, 1, 1];
                pbr.metallicFactor = pbr.metallicFactor ?? 1;
                pbr.roughnessFactor = pbr.roughnessFactor ?? 1;
                if (pbr.normalTexture) {
                    pbr.normalTexture.scale = pbr.normalTexture.scale ?? 1;
                }
                if (pbr.occlusionTexture) {
                    pbr.occlusionTexture.strength = pbr.occlusionTexture.strength ?? 1;
                }
            }
        }
        // Node defaults
        for (const node of gltf.nodes) {
            if (!node.matrix) {
                node.rotation = node.rotation ?? DEFAULT_ROTATION;
                node.scale = node.scale ?? DEFAULT_SCALE;
                node.translation = node.translation ?? DEFAULT_TRANSLATION;
            }
        }
    }
}
//# sourceMappingURL=set-defaults.js.map