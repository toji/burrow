import { AttributeLocation, RenderGeometry } from '../geometry/geometry.js';
import { GeometryLayoutCache } from '../geometry/geometry-layout.js';
var DefaultAttributeFormat;
(function (DefaultAttributeFormat) {
    DefaultAttributeFormat["position"] = "float32x3";
    DefaultAttributeFormat["normal"] = "float32x3";
    DefaultAttributeFormat["tangent"] = "float32x3";
    DefaultAttributeFormat["texcoord"] = "float32x2";
    DefaultAttributeFormat["texcoord2"] = "float32x2";
    DefaultAttributeFormat["color"] = "float32x4";
    DefaultAttributeFormat["joints"] = "uint16x4";
    DefaultAttributeFormat["weights"] = "float32x4";
})(DefaultAttributeFormat || (DefaultAttributeFormat = {}));
;
const DefaultStride = {
    uint8x2: 2,
    uint8x4: 4,
    sint8x2: 2,
    sint8x4: 4,
    unorm8x2: 2,
    unorm8x4: 4,
    snorm8x2: 2,
    snorm8x4: 4,
    uint16x2: 4,
    uint16x4: 8,
    sint16x2: 4,
    sint16x4: 8,
    unorm16x2: 4,
    unorm16x4: 8,
    snorm16x2: 4,
    snorm16x4: 8,
    float16x2: 4,
    float16x4: 8,
    float32: 4,
    float32x2: 8,
    float32x3: 12,
    float32x4: 16,
    uint32: 4,
    uint32x2: 8,
    uint32x3: 12,
    uint32x4: 16,
    sint32: 4,
    sint32x2: 8,
    sint32x3: 12,
    sint32x4: 16,
};
;
;
function nextMultipleOf(size, multiple) {
    return Math.ceil(size / multiple) * multiple;
}
function NormalizeBufferLayout(bufferLayouts) {
    const normalizedLayouts = [];
    // First, find the minimum offset used by any of the attributes and treat that as the buffer
    // binding offset instead. Then split any buffers where the adjusted offset is greater than the
    // stride into separate buffers.
    for (const layout of bufferLayouts) {
        // Skip any buffers that don't have attributes. (Why did you even define that buffer?)
        if (layout.attributes.length == 0) {
            continue;
        }
        const minAttribOffset = layout.attributes.reduce((p, c) => Math.min(p, c.offset), Number.MAX_SAFE_INTEGER);
        let attributes = [];
        for (const attrib of layout.attributes) {
            const adjustedOffset = attrib.offset - minAttribOffset;
            // Sometimes attribs will be fed in that are separate arrays but backed into the same buffer.
            // If the offset is greater than the stride, just treat it as a new buffer with the bigger
            // offset as the base.
            if (adjustedOffset >= layout.arrayStride) {
                normalizedLayouts.push({
                    bufferIndex: layout.bufferIndex,
                    bufferOffset: attrib.offset,
                    arrayStride: layout.arrayStride,
                    attributes: [{
                            offset: 0,
                            shaderLocation: attrib.shaderLocation,
                            format: attrib.format,
                        }],
                });
            }
            else {
                attributes.push({
                    offset: adjustedOffset,
                    shaderLocation: attrib.shaderLocation,
                    format: attrib.format,
                });
            }
        }
        // Sort the attributes by shader location.
        attributes = attributes.sort((a, b) => a.shaderLocation - b.shaderLocation);
        normalizedLayouts.push({
            bufferIndex: layout.bufferIndex,
            bufferOffset: minAttribOffset,
            arrayStride: layout.arrayStride,
            attributes,
        });
    }
    // Finally, sort the buffer layouts by their first attribute's shader location and return.
    return normalizedLayouts.sort((a, b) => a.attributes[0].shaderLocation - b.attributes[0].shaderLocation);
}
;
export class RenderGeometryManager {
    device;
    #geometryLayoutCache = new GeometryLayoutCache();
    constructor(device) {
        this.device = device;
    }
    createGeometry(desc) {
        const device = this.device;
        // Vertex buffer processing
        let maxVertices = Number.MAX_SAFE_INTEGER;
        const vertexBuffers = [];
        const attribValuesToBufferLayout = new Map();
        function createBufferLayoutForValues(values, arrayStride, attribName) {
            let buffer;
            if (values instanceof GPUBuffer) {
                buffer = values;
            }
            else {
                let vertexArray;
                if (ArrayBuffer.isView(values)) {
                    vertexArray = values;
                }
                else if (values instanceof ArrayBuffer) {
                    vertexArray = values;
                }
                else if (Array.isArray(values)) {
                    vertexArray = new Float32Array(values);
                }
                else {
                    return null;
                }
                // Create a corresponding Vertex Buffer
                buffer = device.createBuffer({
                    label: `${desc.label} ${attribName} Vertex Buffer`,
                    size: nextMultipleOf(vertexArray.byteLength, 4),
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(buffer, 0, vertexArray);
            }
            const bufferIndex = vertexBuffers.length;
            vertexBuffers.push(buffer);
            const bufferLayout = {
                bufferIndex,
                bufferOffset: 0,
                arrayStride,
                attributes: []
            };
            attribValuesToBufferLayout.set(values, bufferLayout);
            return bufferLayout;
        }
        for (const attribName of Object.keys(AttributeLocation)) {
            const attrib = desc[attribName];
            if (attrib === undefined) {
                continue;
            }
            const format = attrib?.format ?? DefaultAttributeFormat[attribName];
            const stride = attrib?.stride ?? DefaultStride[format];
            const offset = attrib?.offset ?? 0;
            let bufferLayout = createBufferLayoutForValues(attrib, stride, attribName);
            if (!bufferLayout) {
                const attribDesc = attrib;
                bufferLayout = attribValuesToBufferLayout.get(attribDesc.values);
                if (!bufferLayout) {
                    bufferLayout = createBufferLayoutForValues(attribDesc.values, stride, attribName);
                }
            }
            bufferLayout.attributes.push({
                shaderLocation: AttributeLocation[attribName],
                format,
                offset
            });
            // TODO: Also look at attribValues type, maybe?
            maxVertices = Math.min(maxVertices, vertexBuffers[bufferLayout.bufferIndex].size / stride);
        }
        // Normalize the buffer layouts for optimal caching.
        const bufferLayouts = NormalizeBufferLayout([...attribValuesToBufferLayout.values()]);
        const vertexBindings = bufferLayouts.map((layout, slot) => {
            return {
                slot,
                buffer: vertexBuffers[layout.bufferIndex],
                offset: layout.bufferOffset,
            };
        });
        // Index buffer processing
        let indexBinding;
        if (desc.indices) {
            indexBinding = {
                buffer: null,
                // @ts-ignore
                offset: desc.indices.offset ?? 0,
                // @ts-ignore
                indexFormat: desc.indices.format,
            };
            function createIndexBuffer(values) {
                let buffer;
                if (values instanceof GPUBuffer) {
                    buffer = values;
                    if (!indexBinding.indexFormat) {
                        throw new Error('indexFormat must be specified when indices is a GPUBuffer!');
                    }
                }
                else {
                    let indexArray;
                    if (ArrayBuffer.isView(values)) {
                        indexArray = values;
                        indexBinding.indexFormat = indexArray instanceof Uint16Array ? 'uint16' : 'uint32';
                    }
                    else if (values instanceof ArrayBuffer) {
                        indexArray = values;
                        if (!indexBinding.indexFormat) {
                            throw new Error('indexFormat must be specified when indices is an ArrayBuffer!');
                        }
                    }
                    else if (Array.isArray(values)) {
                        if (indexBinding.indexFormat == 'uint16') {
                            indexArray = new Uint16Array(values);
                        }
                        else {
                            indexArray = new Uint32Array(values);
                        }
                    }
                    else {
                        return null;
                    }
                    // Create a corresponding Index Buffer
                    buffer = device.createBuffer({
                        label: `${desc.label} Index Buffer`,
                        size: nextMultipleOf(indexArray.byteLength, 4),
                        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    });
                    device.queue.writeBuffer(buffer, 0, indexArray);
                }
                return buffer;
            }
            indexBinding.buffer = createIndexBuffer(desc.indices);
            if (!indexBinding.buffer) {
                // @ts-ignore
                indexBinding.buffer = createIndexBuffer(desc.indices.values);
            }
        }
        let drawCount = desc.drawCount;
        if (drawCount === undefined) {
            if (indexBinding) {
                drawCount = indexBinding.buffer.size / (indexBinding.indexFormat == 'uint16' ? 2 : 4);
            }
            else {
                drawCount = maxVertices;
            }
        }
        const geometryLayout = this.#geometryLayoutCache.createLayout(bufferLayouts, desc.topology ?? 'triangle-list', indexBinding?.indexFormat);
        return new RenderGeometry(drawCount, vertexBindings, geometryLayout, indexBinding);
    }
    ;
}
//# sourceMappingURL=render-geometry.js.map