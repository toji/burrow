import { Mat4 } from '../../third-party/gl-matrix/dist/src/mat4.js';
import { WebGpuGltfLoader } from '../../third-party/hoard-gpu/dist/gltf/webgpu-gltf-loader.js';
import { ComputeAABB } from '../../third-party/hoard-gpu/dist/gltf/transforms/compute-aabb.js';
const GL = WebGLRenderingContext;
function gpuFormatForAccessor(accessor) {
    const norm = accessor.normalized ? 'norm' : 'int';
    const count = accessor.extras.componentCount;
    const x = count > 1 ? `x${count}` : '';
    switch (accessor.componentType) {
        case GL.BYTE: return `s${norm}8${x}`;
        case GL.UNSIGNED_BYTE: return `u${norm}8${x}`;
        case GL.SHORT: return `s${norm}16${x}`;
        case GL.UNSIGNED_SHORT: return `u${norm}16${x}`;
        case GL.UNSIGNED_INT: return `u${norm}32${x}`;
        case GL.FLOAT: return `float32${x}`;
    }
}
function gpuIndexFormatForComponentType(componentType) {
    switch (componentType) {
        case GL.UNSIGNED_SHORT: return 'uint16';
        case GL.UNSIGNED_INT: return 'uint32';
        default: return undefined;
    }
}
function gpuPrimitiveTopologyForMode(mode) {
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
    renderer;
    #hoardLoader;
    constructor(renderer) {
        this.renderer = renderer;
        this.#hoardLoader = new WebGpuGltfLoader(renderer.device, [ComputeAABB]);
    }
    get textureLoader() {
        return this.#hoardLoader.textureLoader;
    }
    clearCache() {
        this.#hoardLoader.clearCache();
    }
    async loadFromUrl(url) {
        const gltf = await this.#hoardLoader.loadFromUrl(url);
        const renderMaterials = [];
        function getTexture(textureInfo) {
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
        for (const material of gltf.materials) {
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
                transparent: material.alphaMode == 'BLEND',
                alphaCutoff: material.alphaMode == 'MASK' ? (material.alphaCutoff ?? 0.5) : 0,
            }));
        }
        const meshes = [];
        for (let i = 0; i < gltf.meshes.length; ++i) {
            const mesh = gltf.meshes[i];
            const primitives = [];
            for (const primitive of mesh.primitives) {
                const primitiveDescriptor = {
                    label: primitive.name,
                    topology: gpuPrimitiveTopologyForMode(primitive.mode),
                };
                for (const [attribName, accessorIndex] of Object.entries(primitive.attributes)) {
                    const primitiveAttrib = ATTRIB_MAPPING[attribName];
                    if (!primitiveAttrib) {
                        console.log(`Skipping unknown attribute ${attribName}`);
                        continue;
                    }
                    const accessor = gltf.accessors[accessorIndex];
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
                    geometry: this.renderer.createGeometry(primitiveDescriptor),
                    material: renderMaterials[primitive.material],
                };
                primitives.push(renderMesh);
            }
            meshes.push(primitives);
        }
        const renderScene = {
            meshes: []
        };
        // @ts-ignore
        const sceneAabb = gltf.scenes[gltf.scene].extras.aabb;
        // HACK!
        const sceneTransform = new Mat4();
        if (url.includes('Sponza')) {
            sceneTransform.translate([-sceneAabb.center[0], -sceneAabb.center[1] * 0.5, -sceneAabb.center[2]]);
        }
        else {
            sceneTransform.scale([2 / sceneAabb.radius, 2 / sceneAabb.radius, 2 / sceneAabb.radius]);
            sceneTransform.translate([-sceneAabb.center[0], -sceneAabb.center[1], -sceneAabb.center[2]]);
        }
        for (const node of gltf.nodes) {
            if (node.mesh !== undefined) {
                const meshPrimitives = meshes[node.mesh];
                for (const primitive of meshPrimitives) {
                    const transform = new Mat4(sceneTransform);
                    transform.multiply(node.extras.worldMatrix);
                    renderScene.meshes.push({
                        ...primitive,
                        transform
                    });
                }
            }
        }
        return renderScene;
    }
}
//# sourceMappingURL=gltf.js.map