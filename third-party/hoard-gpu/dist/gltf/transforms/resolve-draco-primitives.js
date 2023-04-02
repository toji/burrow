import { GltfTransform } from './gltf-transform.js';
import { WorkerPool } from '../../workers/worker-pool.js';
// To make it easier to reference the WebGL enums that glTF uses.
const GL = WebGLRenderingContext;
class DracoDecoder extends WorkerPool {
    constructor() {
        super(`draco/draco-worker.js`);
    }
    decode(buffer, attributes, indexSize) {
        const arrayBuffer = new Uint8Array(buffer);
        return this.dispatch({
            buffer: arrayBuffer,
            attributes,
            indexSize
        }, [arrayBuffer.buffer]);
    }
}
// Resolves every draco-encoded primitive in the glTF file into a regular buffer/buffer view.
export class ResolveDracoPrimitives extends GltfTransform {
    decoder;
    async transform(gltf, buffers, images, options, transformResults) {
        // If we need draco decoding and we haven't yet created a decoder, do so now.
        if (!this.decoder && gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
            this.decoder = new DracoDecoder();
        }
        const dracoDecoder = this.decoder;
        const url = options.url;
        async function decodeDracoPrimitive(primitive, dracoExt, meshIndex, primitiveIndex) {
            let indexSize = 0;
            if ('indices' in primitive) {
                const indexAccessor = gltf.accessors[primitive.indices];
                indexSize = indexAccessor.componentType == GL.UNSIGNED_INT ? 4 : 2;
            }
            // Create new buffer views for all the primitive attributes.
            const primitiveBufferViews = {};
            for (const name in dracoExt.attributes) {
                const accessor = gltf.accessors[primitive.attributes[name]];
                accessor.bufferView = buffers.createEmptyBufferView({ target: GL.ARRAY_BUFFER });
                accessor.byteOffset = 0;
                primitiveBufferViews[name] = buffers.getBufferView(accessor.bufferView);
            }
            if (indexSize) {
                const accessor = gltf.accessors[primitive.indices];
                accessor.bufferView = buffers.createEmptyBufferView({ target: GL.ELEMENT_ARRAY_BUFFER });
                accessor.byteOffset = 0;
                primitiveBufferViews.INDICES = buffers.getBufferView(accessor.bufferView);
            }
            const bufferView = buffers.getBufferView(dracoExt.bufferView);
            const decodedPrimitive = await dracoDecoder.decode(await bufferView.asByteArray(), dracoExt.attributes, indexSize);
            // This buffer view will no longer be needed after decoding.
            buffers.removeBufferView(dracoExt.bufferView);
            const decodedBufferViews = decodedPrimitive.bufferViews;
            for (const name in dracoExt.attributes) {
                const bufferView = primitiveBufferViews[name];
                bufferView.byteOffset = decodedBufferViews[name].byteOffset;
                bufferView.byteLength = decodedBufferViews[name].byteLength;
                bufferView.byteStride = decodedBufferViews[name].byteStride;
                bufferView.resolveWithArrayBuffer(decodedPrimitive.buffer);
            }
            if (indexSize) {
                const bufferView = primitiveBufferViews.INDICES;
                bufferView.byteOffset = decodedBufferViews.INDICES.byteOffset;
                bufferView.byteLength = decodedBufferViews.INDICES.byteLength;
                bufferView.byteStride = decodedBufferViews.INDICES.byteStride;
                bufferView.resolveWithArrayBuffer(decodedPrimitive.buffer);
            }
        }
        // Find any primitives that need Draco decoding and decode them.
        const pendingPrimitives = [];
        for (const meshIndex in gltf.meshes) {
            const mesh = gltf.meshes[meshIndex];
            for (const primitiveIndex in mesh.primitives) {
                const primitive = mesh.primitives[primitiveIndex];
                const dracoExt = primitive.extensions?.KHR_draco_mesh_compression;
                if (dracoExt) {
                    pendingPrimitives.push(decodeDracoPrimitive(primitive, dracoExt, meshIndex, primitiveIndex));
                }
            }
        }
        await Promise.all(pendingPrimitives);
    }
}
//# sourceMappingURL=resolve-draco-primitives.js.map