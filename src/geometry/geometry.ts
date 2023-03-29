import { GeometryLayout } from './geometry-layout.js';

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

export interface GeometryBufferBinding {
  bufferIndex: number;
  bufferOffset: number;
};

export interface GeometryBufferLayout extends GPUVertexBufferLayout, GeometryBufferBinding {
};

enum DefaultAttributeFormat {
  position = 'float32x3',
  normal = 'float32x3',
  tangent = 'float32x3',
  texcoord = 'float32x2',
  texcoord2 = 'float32x2',
  color = 'float32x4',
  joints = 'uint16x4',
  weights = 'float32x4',
};

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

export type TypedArray =
  Float32Array | Float64Array |
  Uint32Array | Int32Array |
  Uint16Array | Int16Array |
  Uint8Array | Int8Array;

type GeometryAttributeValues = GPUBuffer | TypedArray | number[];

interface AttributeDescriptor {
  values: GeometryAttributeValues;
  offset?: number;
  stride?: number;
  format?: GPUVertexFormat;
};

type GeometryAttribute = GeometryAttributeValues | AttributeDescriptor;

export interface GeometryDescriptor {
  label?: string;

  position: GeometryAttribute,
  normal?: GeometryAttribute,
  tangent?: GeometryAttribute,
  texcoord?: GeometryAttribute,
  texcoord2?: GeometryAttribute,
  color?: GeometryAttribute,
  joints?: GeometryAttribute,
  weights?: GeometryAttribute,

  drawCount?: number;
  indices?: Uint16Array | Uint32Array | Array<number>;
  topology?: GPUPrimitiveTopology;
};

export function buildGeometryCreationArgs(id: number, desc: GeometryDescriptor): GeometryCreationArgs {
  let maxVertices = Number.MAX_SAFE_INTEGER;

  const vertexArrays: TypedArray[] = [];
  const attribValuesToBuffer = new Map<GeometryAttributeValues, GeometryBufferLayout>();
  function createBufferLayoutForValues(values: GeometryAttributeValues, arrayStride: number): GeometryBufferLayout {
    let vertexArray: TypedArray;
    if (ArrayBuffer.isView(values)) {
      vertexArray = values;
    } else if (values instanceof ArrayBuffer) {
      vertexArray = new Uint8Array(values);
    } else if (Array.isArray(values)) {
      vertexArray = new Float32Array(values);
    } else {
      return null;
    }

    const bufferIndex = vertexArrays.length;
    vertexArrays.push(vertexArray);
    const buffer: GeometryBufferLayout = {
      bufferIndex,
      bufferOffset: 0,
      arrayStride,
      attributes: []
    };
    attribValuesToBuffer.set(values, buffer);
    return buffer;
  }

  for (const attribName of Object.keys(AttributeLocation)) {
    const attrib = desc[attribName];
    if (attrib === undefined) { continue; }

    const format = attrib?.format ?? DefaultAttributeFormat[attribName];
    const stride = attrib?.stride ?? DefaultStride[format];

    let buffer = createBufferLayoutForValues(attrib as GeometryAttributeValues, stride);
    if (!buffer) {
      const attribDesc = (attrib as AttributeDescriptor);
      buffer = attribValuesToBuffer.get(attribDesc.values);
      if (!buffer) {
        buffer = createBufferLayoutForValues(attribDesc.values, stride);
      }
    }
    
    (buffer.attributes as GPUVertexAttribute[]).push({
      shaderLocation: AttributeLocation[attribName],
      format,
      offset: attrib?.offset ?? 0
    });

    // TODO: Also look at attribValues type, maybe?
    maxVertices = Math.min(maxVertices, vertexArrays[buffer.bufferIndex].byteLength / stride);
  }

  // Normalize the buffer layouts for optimal caching.
  const buffers = NormalizeBufferLayout([...attribValuesToBuffer.values()]);

  let indexArray: Uint16Array | Uint32Array;
  if (desc.indices) {
    if (Array.isArray(desc.indices)) {
      indexArray = new Uint32Array(desc.indices);
    } else {
      indexArray = desc.indices;
    }
  }

  const indexFormat: GPUIndexFormat = indexArray instanceof Uint16Array ? 'uint16' : 'uint32';
  const layout = new GeometryLayout(buffers, desc.topology ?? 'triangle-list', indexFormat);

  let drawCount = desc.drawCount;
  if (drawCount === undefined) {
    if (indexArray) {
      drawCount = indexArray.length;
    } else {
      drawCount = maxVertices;
    }
  }

  return {
    id,
    drawCount,
    indexArray,
    vertexArrays,
    bindings: buffers.map((value) => { return { bufferIndex: value.bufferIndex, bufferOffset: value.bufferOffset }; }),
    layout: layout.serializeToString(),
  };
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


export interface RenderBufferBinding {
  buffer: GPUBuffer;
  offset: number;
  indexFormat?: GPUIndexFormat;
};

export class RenderGeometry {
  constructor(
    public clientId: number,
    public drawCount: number,
    public vertexBuffers: RenderBufferBinding[],
    public layout: Readonly<GeometryLayout>,
    public indexBuffer?: RenderBufferBinding,
  ) {}
};

function nextMultipleOf(size: number, multiple: number): number {
  return Math.ceil(size / multiple) * multiple;
}

export function createStaticGeometry(device: GPUDevice, args: GeometryCreationArgs) {
  const gpuBuffers: GPUBuffer[] = [];
  for (const array of args.vertexArrays) {
    const gpuBuffer = device.createBuffer({
      size: nextMultipleOf(array.byteLength, 4),
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    // @ts-ignore
    const gpuArray = new array.constructor(gpuBuffer.getMappedRange());
    gpuArray.set(array);
    gpuBuffer.unmap();

    gpuBuffers.push(gpuBuffer);
  }

  // Populate the list of vertexBuffers now that we know the final buffer layout/offsets.
  const vertexBuffers: RenderBufferBinding[] = args.bindings.map((layout) => {
      return {
        buffer: gpuBuffers[layout.bufferIndex],
        offset: layout.bufferOffset,
      };
  });

  let indexBuffer: RenderBufferBinding;
  if (args.indexArray) {
    const gpuBuffer = device.createBuffer({
      size: nextMultipleOf(args.indexArray.byteLength, 4),
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    // @ts-ignore
    const gpuArray = new args.indexArray.constructor(gpuBuffer.getMappedRange());
    gpuArray.set(args.indexArray);
    gpuBuffer.unmap();

    indexBuffer = {
      buffer: gpuBuffer,
      offset: 0,
      indexFormat: args.indexArray instanceof Uint16Array ? 'uint16' : 'uint32',
    };
  }

  const geometryLayout = this.geometryLayoutCache.deserializeLayout(args.layout);
  console.log(`Geometry Layout #${geometryLayout.id}: ${geometryLayout.serializeToString()}`);

  this.geometries.set(args.id,
    new RenderGeometry(args.id, args.drawCount, vertexBuffers, geometryLayout, indexBuffer));
}
