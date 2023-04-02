import { GltfTransform } from './gltf-transform.js';
import { SetDefaults } from './set-defaults.js';
const GL = WebGLRenderingContext;
function getComponentTypeArrayConstructor(componentType) {
    switch (componentType) {
        case GL.BYTE: return Int8Array;
        case GL.UNSIGNED_BYTE: return Uint8Array;
        case GL.SHORT: return Int16Array;
        case GL.UNSIGNED_SHORT: return Uint16Array;
        case GL.UNSIGNED_INT: return Uint32Array;
        case GL.FLOAT: return Float32Array;
        default: throw new Error(`Unexpected componentType: ${componentType}`);
    }
}
// Resolves every sparse accessor in the glTF file into new buffer/buffer views.
export class ResolveSparseAccessors extends GltfTransform {
    static Dependencies = [SetDefaults];
    transform(gltf, buffers, images) {
        for (const accessor of gltf.accessors) {
            if (accessor.bufferView === undefined || accessor.sparse) {
                const componentCount = accessor.extras.componentCount;
                const sparse = accessor.sparse;
                const srcBufferView = buffers.getBufferView(accessor.bufferView);
                const byteStride = srcBufferView?.byteStride ?? accessor.extras.packedByteStride;
                const byteLength = srcBufferView?.byteLength ?? byteStride * accessor.count;
                // Resolve the sparse accessor into a fully populated buffer.
                const arrayBufferPromise = new Promise(async (resolve) => {
                    const arrayBuffer = new ArrayBuffer(byteLength);
                    // If there is a source buffer view given, the buffer should be initialized to the contents of that buffer view.
                    // Otherwise it should be initialized to zero (which is the default state for a new ArrayBuffer);
                    if (srcBufferView) {
                        new Uint8Array(arrayBuffer).set(await srcBufferView.asByteArray());
                    }
                    // If the accessor contains sparse data populate it into the buffer now.
                    // TODO: Turns out this needs to apply to non-default accessors as well.
                    if (sparse) {
                        const indexBufferView = buffers.getBufferView(sparse.indices.bufferView);
                        const valueBufferView = buffers.getBufferView(sparse.values.bufferView);
                        const indexByteOffset = indexBufferView.byteOffset + (sparse.indices.byteOffset || 0);
                        const indexArrayType = getComponentTypeArrayConstructor(sparse.indices.componentType);
                        const indices = new indexArrayType((await indexBufferView.asByteArray()).buffer, indexByteOffset);
                        const valueByteOffset = valueBufferView.byteOffset + (sparse.values.byteOffset || 0);
                        const valueArrayType = getComponentTypeArrayConstructor(accessor.componentType);
                        const srcValues = new valueArrayType((await valueBufferView.asByteArray()).buffer, valueByteOffset);
                        const dstValues = new valueArrayType(arrayBuffer);
                        const elementStride = byteStride / valueArrayType.BYTES_PER_ELEMENT;
                        // Copy the sparse values into the newly created buffer
                        for (let i = 0; i < sparse.count; ++i) {
                            const dstIndex = indices[i] * elementStride;
                            const srcIndex = i * componentCount;
                            for (let j = 0; j < componentCount; ++j) {
                                dstValues[dstIndex + j] = srcValues[srcIndex + j];
                            }
                        }
                    }
                    resolve(arrayBuffer);
                });
                // Point the accessor at a new, non-sparse buffer view.
                accessor.bufferView = buffers.createBufferViewFromArrayBuffer(arrayBufferPromise, {
                    byteOffset: 0,
                    byteStride,
                    byteLength,
                    name: `Populated Sparse Buffer View`,
                    target: accessor.target,
                });
                // Not sparse any more.
                delete accessor.sparse;
            }
        }
    }
}
//# sourceMappingURL=resolve-sparse-accessors.js.map