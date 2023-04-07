import { GltfTransform } from './gltf-transform.js';
import { generateTangents } from '../../../node_modules/mikktspace/dist/main/mikktspace_main.js';
import { SetDefaults } from './set-defaults.js';
const GL = WebGLRenderingContext;
// Generates tangents for any mesh with a normal map that doesn't already have them.
// Uses https://www.npmjs.com/package/mikktspace for tangent generation.
export class GenerateTangents extends GltfTransform {
    Dependencies = [SetDefaults];
    async transform(gltf, buffers, images, options, transformResults) {
        async function getAccessorAsFloat32Array(accessorIndex) {
            const accessor = gltf.accessors[accessorIndex];
            const bufferView = buffers.getBufferView(accessor.bufferView);
            const componentCount = accessor.extras.componentCount;
            const stride = bufferView.byteStride || accessor.extras.packedByteStride;
            const arrayLength = accessor.count * componentCount;
            const byteArray = await bufferView.asByteArray();
            // If the accessor is already a well packed float array, just return it.
            if (stride == Float32Array.BYTES_PER_ELEMENT * componentCount && accessor.type == GL.FLOAT) {
                return new Float32Array(byteArray.buffer, byteArray.byteOffset + accessor.byteOffset, arrayLength);
            }
            // TODO: Handle accessor.types other than GL.FLOAT.
            const inArray = new Float32Array(byteArray.buffer, byteArray.byteOffset + accessor.byteOffset, byteArray.byteLength - accessor.byteOffset);
            // Otherwise copy the values in one by one.
            const outArray = new Float32Array(arrayLength);
            for (let i = 0; i < accessor.count; ++i) {
                const offset = (i * stride) / inArray.BYTES_PER_ELEMENT;
                for (let j = 0; j < componentCount; ++j) {
                    outArray[i * componentCount + j] = inArray[offset + j];
                }
            }
            return outArray;
        }
        async function GenerateTangentsForPrimitive(primitive) {
            const positions = await getAccessorAsFloat32Array(primitive.attributes.POSITION);
            const normals = await getAccessorAsFloat32Array(primitive.attributes.NORMALS);
            const texcoord = await getAccessorAsFloat32Array(primitive.attributes.TEXCOORD_0);
            const tangents = generateTangents(positions, normals, texcoord); // TODO: Maybe push this to a worker?
            const bufferView = buffers.createBufferViewFromArrayBuffer(Promise.resolve(tangents.buffer), {
                buffer: 0,
                byteOffset: 0,
                byteStride: 16,
                byteLength: tangents.byteLength,
                name: `Mikktspace generated tangent buffer`,
                target: GL.ARRAY_BUFFER,
            });
            primitive.attributes.TANGENT = gltf.accessors.length;
            gltf.accessors.push({
                bufferView,
                byteOffset: 0,
                componentType: GL.FLOAT,
                normalized: false,
                count: tangents.length / 4,
                type: 'VEC4',
                name: `Mikktspace generated tangent accessor`,
            });
        }
        const pendingTangents = [];
        for (const mesh of gltf.meshes) {
            for (const primitive of mesh.primitives) {
                // IF the primitive already has tangents, nothing to do here.
                if ('TANGENT' in primitive.attributes) {
                    continue;
                }
                // The primitive must have at least position, normal, and texcoord values in order to
                // generate tangents.
                if ('POSITION' in primitive.attributes &&
                    'NORMAL' in primitive.attributes &&
                    'TEXCOORD_0' in primitive.attributes) {
                    // Only generate tangents if the associated material has a normal map.
                    const material = gltf.materials[primitive.material];
                    if (material && material.normalTexture) {
                        // Generate tangents for this primitive!
                        console.log(`Need to generate tangents! Indexed: ${!!primitive.indices}`);
                        pendingTangents.push(GenerateTangentsForPrimitive(primitive));
                    }
                }
            }
        }
        return Promise.all(pendingTangents);
    }
}
//# sourceMappingURL=generate-tangents.js.map