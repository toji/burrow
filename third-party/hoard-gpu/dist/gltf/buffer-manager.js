import { resolveUri } from '../common/uri-utils.js';
function alignTo4(value) { return Math.ceil(value / 4) * 4; }
export class BufferManager {
    #buffers = [];
    #bufferViews = [];
    constructor(gltf, baseUrl, glbBinaryChunk) {
        if (glbBinaryChunk) {
            this.#buffers[0] = Promise.resolve(glbBinaryChunk);
        }
        // Load all buffers with a uri
        for (const bufferIndex in gltf.buffers) {
            const buffer = gltf.buffers[bufferIndex];
            if (!buffer.uri) {
                continue;
            }
            const uri = resolveUri(buffer.uri, baseUrl);
            this.#buffers[bufferIndex] = fetch(uri).then((response) => {
                return response.arrayBuffer();
            });
        }
        for (const bufferViewIndex in gltf.bufferViews) {
            const bufferView = gltf.bufferViews[bufferViewIndex];
            this.#bufferViews[bufferViewIndex] = new ManagedBufferView(bufferView);
            this.#buffers[bufferView.buffer].then((arrayBuffer) => {
                this.#bufferViews[bufferViewIndex].resolveWithArrayBuffer(arrayBuffer);
            });
        }
    }
    createBufferViewFromArrayBuffer(bufferPromise, bufferView) {
        const bufferViewIndex = this.#bufferViews.length;
        this.#bufferViews[bufferViewIndex] = new ManagedBufferView(bufferView);
        Promise.resolve(bufferPromise).then((arrayBuffer) => {
            this.#bufferViews[bufferViewIndex].resolveWithArrayBuffer(arrayBuffer);
        });
        return bufferViewIndex;
    }
    createEmptyBufferView(bufferView) {
        const bufferViewIndex = this.#bufferViews.length;
        this.#bufferViews[bufferViewIndex] = new ManagedBufferView(bufferView);
        return bufferViewIndex;
    }
    removeBufferView(index) {
        this.#bufferViews[index].byteLength = 0;
    }
    getBufferView(index) {
        if (index === undefined) {
            return undefined;
        }
        return this.#bufferViews[index];
    }
    get bufferViews() {
        return [...this.#bufferViews.values()];
    }
    async updateCache(gltf, cache) {
        const json = structuredClone(gltf);
        json.buffers = [];
        json.bufferViews = [];
        await Promise.all(this.#bufferViews.map((bufferView) => bufferView.asByteArray()));
        const totalBufferSize = this.#bufferViews.reduce((v, bufferView) => v + (alignTo4(bufferView?.byteLength) ?? 0), 0);
        const combinedBuffer = new ArrayBuffer(totalBufferSize);
        const combinedByteArray = new Uint8Array(combinedBuffer);
        let byteOffset = 0;
        for (const bufferView of this.#bufferViews) {
            if (bufferView.byteLength) {
                combinedByteArray.set(await bufferView.asByteArray(), byteOffset);
            }
            json.bufferViews.push(bufferView.toJson(byteOffset));
            // Round to the nearest multiple of 4 to ensure proper byte alignment for TypedArrays.
            byteOffset += alignTo4(bufferView.byteLength);
        }
        cache.setMulti(gltf.extras.url, {
            json,
            glbBinaryChunk: combinedBuffer
        });
    }
}
export class ManagedBufferView {
    buffer; // Unused
    byteOffset;
    byteLength;
    byteStride;
    target;
    name;
    extension;
    extras;
    #resolver;
    #byteArray;
    constructor(bufferView) {
        this.#byteArray = new Promise((resolve) => {
            this.#resolver = resolve;
        });
        this.buffer = bufferView.buffer ?? 0;
        this.byteOffset = bufferView.byteOffset ?? 0;
        this.byteStride = bufferView.byteStride;
        this.byteLength = bufferView.byteLength;
        this.target = bufferView.target;
        this.name = bufferView.name;
        this.extension = bufferView.extension;
        this.extras = bufferView.extras;
    }
    resolveWithArrayBuffer(arrayBuffer) {
        // If the byteLength is undefined, compute it from the arrayBuffer once it resolves.
        if (this.byteLength === undefined) {
            this.byteLength = arrayBuffer.byteLength - this.byteOffset;
        }
        this.#resolver(new Uint8Array(arrayBuffer, this.byteOffset, this.byteLength));
    }
    asByteArray() {
        return this.#byteArray;
    }
    toJson(overrideByteOffset) {
        return {
            buffer: 0,
            byteOffset: overrideByteOffset ?? this.byteOffset,
            byteStride: this.byteStride,
            byteLength: this.byteLength,
            target: this.target,
            name: this.name,
            extension: this.extension,
            extras: this.extras,
        };
    }
    async toResolvedBufferView() {
        return {
            buffer: this.buffer,
            byteOffset: this.byteOffset,
            byteStride: this.byteStride,
            byteLength: this.byteLength,
            target: this.target,
            name: this.name,
            extension: this.extension,
            extras: this.extras,
            byteArray: await this.asByteArray(),
        };
    }
}
//# sourceMappingURL=buffer-manager.js.map