export enum AttributeLocation {
  position = 0,
  normal =  1,
  tangent = 2,
  texcoord = 3,
  texcoord2 = 4,
  color = 5,
  joints = 6,
  weights = 7,
};

export type TypedArray =
  Float32Array | Float64Array |
  Uint32Array | Int32Array |
  Uint16Array | Int16Array |
  Uint8Array | Int8Array;

export interface GeometryBufferBinding {
  bufferIndex: number;
  bufferOffset: number;
};

export interface GeometryBufferLayout extends GPUVertexBufferLayout, GeometryBufferBinding {
};

export interface GeometryCreationArgs {
  id: number;
  drawCount: number;
  vertexArrays: TypedArray[];
  indexArray?: Uint16Array | Uint32Array;
  bindings: GeometryBufferBinding[];
  layout: string;
};

export function NormalizeBufferLayout(bufferLayouts: GeometryBufferLayout[]): GeometryBufferLayout[] {
  const normalizedLayouts: GeometryBufferLayout[] = [];
  
  // First, find the minimum offset used by any of the attributes and treat that as the buffer
  // binding offset instead. Then split any buffers where the adjusted offset is greater than the
  // stride into separate buffers.
  for (const layout of bufferLayouts) {
    // Skip any buffers that don't have attributes. (Why did you even define that buffer?)
    if ((layout.attributes as []).length == 0) {
      continue;
    }

    const minAttribOffset = (layout.attributes as []).reduce((p: number, c: GPUVertexAttribute):number => Math.min(p, c.offset), Number.MAX_SAFE_INTEGER);
    
    let attributes: GPUVertexAttribute[] = [];
    for (const attrib of layout.attributes) {
      const adjustedOffset = attrib.offset - minAttribOffset;
      // Sometimes attribs will be fed in that are separate arrays but backed into the same buffer.
      // If the offset is greater than the stride, just treat it as a new buffer with the bigger
      // offset as the base.
      if (adjustedOffset >= layout.arrayStride) {
        normalizedLayouts.push({
          bufferIndex: layout.bufferIndex,
          bufferOffset: adjustedOffset,
          arrayStride: layout.arrayStride,
          attributes: [{
            offset: 0,
            shaderLocation: attrib.shaderLocation,
            format: attrib.format,
          }],
        });
      } else {
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
};
