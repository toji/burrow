enum TopologyId {
  'point-list',
  'line-list',
  'line-strip',
  'triangle-strip',
  'triangle-list',
};

const TopologyMask = TopologyId["point-list"] |
                     TopologyId["line-list"] |
                     TopologyId["line-strip"] |
                     TopologyId["triangle-strip"] |
                     TopologyId["triangle-list"];

enum StripIndexFormatId {
  uint16 = 0x00,
  uint32 = 0x08,
};

enum FormatId {
  uint8x2,
  uint8x4,
  sint8x2,
  sint8x4,
  unorm8x2,
  unorm8x4,
  snorm8x2,
  snorm8x4,
  uint16x2,
  uint16x4,
  sint16x2,
  sint16x4,
  unorm16x2,
  unorm16x4,
  snorm16x2,
  snorm16x4,
  float16x2,
  float16x4,
  float32,
  float32x2,
  float32x3,
  float32x4,
  uint32,
  uint32x2,
  uint32x3,
  uint32x4,
  sint32,
  sint32x2,
  sint32x3,
  sint32x4,
};

enum StepModeId {
  vertex   = 0x0000,
  instance = 0x8000,
};

const Uint8ToHex = new Array(256);
for (let i = 0; i <= 0xFF; ++i) {
    Uint8ToHex[i] = i.toString(16).padStart(2, '0');
}

const HexToUint8 = new Array(256);
for (let i = 0; i <= 0xFF; ++i) {
  HexToUint8[i.toString(16).padStart(2, '0')] = i;
}

export interface GeometryLocationDesciption {
  bufferIndex: number,
  arrayStride: number,
  offset: number,
  format: GPUVertexFormat,
}

export class GeometryLayout {
  id: number;

  buffers: GPUVertexBufferLayout[];
  topology: GPUPrimitiveTopology;
  stripIndexFormat?: GPUIndexFormat;

  #serializedBuffer: ArrayBuffer;
  #serializedString: string;
  #locationsUsed: Set<number>;
  #locationsDesc: Map<number, GeometryLocationDesciption>;

  constructor(buffers: GPUVertexBufferLayout[],
              topology: GPUPrimitiveTopology,
              indexFormat: GPUIndexFormat = 'uint32') {
    this.buffers = buffers;
    this.topology = topology;
    if (topology == 'triangle-strip' || topology == 'line-strip') {
      this.stripIndexFormat = indexFormat;
    }
  }

  get locationsUsed(): Set<number> {
    if (!this.#locationsUsed) {
      this.#locationsUsed = new Set<number>();
      for (const buffer of this.buffers) {
        for (const attrib of buffer.attributes) {
          this.#locationsUsed.add(attrib.shaderLocation);
        }
      }
    }

    return this.#locationsUsed;
  }

  getLocationDesc(shaderLocation: number): GeometryLocationDesciption {
    if (!this.#locationsDesc) {
      this.#locationsDesc = new Map();
      for (const [bufferIndex, buffer] of this.buffers.entries()) {
        for (const attrib of buffer.attributes) {
          this.#locationsDesc.set(attrib.shaderLocation, {
            bufferIndex,
            arrayStride: buffer.arrayStride,
            offset: attrib.offset,
            format: attrib.format
          });
        }
      }
    }
    return this.#locationsDesc.get(shaderLocation);
  }

  serializeToBuffer() {
    if (this.#serializedBuffer) {
      return this.#serializedBuffer;
    }

    let attribCount = 0;
    for (const buffer of this.buffers) {
      attribCount += (buffer.attributes as []).length;
    }

    // Each buffer takes 2 bytes to encode and each attribute takes 3 bytes.
    // The primitive topology takes 1 byte.
    const byteLength = 1 + (this.buffers.length * 2) + attribCount * 3;
    const outBuffer = new ArrayBuffer(byteLength);
    const dataView = new DataView(outBuffer);

    let topologyData8 = TopologyId[this.topology];
    if (this.stripIndexFormat !== undefined) {
      topologyData8 += StripIndexFormatId[this.stripIndexFormat];
    }
    dataView.setUint8(0, topologyData8);

    let offset = 1;
    for (const buffer of this.buffers) {
      let bufferData16 = (buffer.attributes as []).length; // Lowest 4 bits
      bufferData16 += buffer.arrayStride << 4;          // Middle 11 bits
      bufferData16 += StepModeId[buffer.stepMode || 'vertex']; // Highest bit
      dataView.setUint16(offset, bufferData16, true);
      offset += 2;

      for (const attrib of buffer.attributes) {
        let attribData16 = attrib.offset || 0; // Lowest 12 bits
        attribData16 += attrib.shaderLocation << 12; // Highest 4 bits
        dataView.setUint16(offset, attribData16, true);
        dataView.setUint8(offset+2, FormatId[attrib.format]);

        offset += 3;
      }
    }

    this.#serializedBuffer = outBuffer;
    return outBuffer;
  }

  serializeToString() {
    if (this.#serializedString) { return this.#serializedString; }

    const array = new Uint8Array(this.serializeToBuffer());
    let outStr = '';
    for (let i = 0; i < array.length; ++i) {
      outStr += Uint8ToHex[array[i]];
    }

    this.#serializedString = outStr;
    return outStr;
  }

  static deserializeFromBuffer(inBuffer: ArrayBuffer, bufferOffest?: number, bufferLength?: number) {
    const dataView = new DataView(inBuffer, bufferOffest, bufferLength);

    const topologyData8 = dataView.getUint8(0);
    const topology = TopologyId[topologyData8 & TopologyMask] as GPUPrimitiveTopology;

    let stripIndexFormat = 'uint32' as GPUIndexFormat;
    switch(topology) {
      case 'triangle-strip':
      case 'line-strip':
        stripIndexFormat = StripIndexFormatId[topologyData8 & 0x08] as GPUIndexFormat;
    }

    const buffers = [];
    let offset = 1;
    while (offset < dataView.byteLength) {
      const bufferData16 = dataView.getUint16(offset, true);
      const attribCount = bufferData16 & 0x0F;
      let buffer = {
        attributes: new Array(attribCount),
        arrayStride: (bufferData16 >> 4) & 0x08FF,
        stepMode: StepModeId[bufferData16 & 0x8000],
      };
      buffers.push(buffer);
      offset += 2;

      for (let i = 0; i < attribCount; ++i) {
        const attribData16 = dataView.getUint16(offset, true);
        buffer.attributes[i] = {
          offset: attribData16 & 0x0FFF,
          shaderLocation: (attribData16 >> 12) & 0x0F,
          format: FormatId[dataView.getUint8(offset+2)]
        };
        offset += 3;
      }
    }

    return new GeometryLayout(buffers, topology, stripIndexFormat);
  }

  static deserializeFromString(value: string) {
    const array = new Uint8Array(value.length / 2);
    for (let i = 0; i < array.length; ++i) {
      const strOffset = i*2;
      array[i] = HexToUint8[value.substring(strOffset, strOffset+2)];
    }
    const layout = GeometryLayout.deserializeFromBuffer(array.buffer);
    layout.#serializedBuffer = array.buffer;
    layout.#serializedString = value;
    return layout;
  }
};

export class GeometryLayoutCache {
  #nextId = 1;
  #keyMap = new Map<string, number>(); // Map of the given key to an ID
  #cache = new Map<number, Readonly<GeometryLayout>>(); // Map of ID to cached resource

  getLayout(id: number): Readonly<GeometryLayout> {
    return this.#cache.get(id);
  }

  addLayoutToCache(layout: GeometryLayout, key: string): Readonly<GeometryLayout> {
    layout.id = this.#nextId++;
    Object.freeze(layout);

    this.#keyMap.set(key, layout.id);
    this.#cache.set(layout.id, layout);

    return layout;
  }

  deserializeLayout(key: string): Readonly<GeometryLayout> {
    const id = this.#keyMap.get(key);

    if (id !== undefined) {
      return this.#cache.get(id);
    }

    const layout = GeometryLayout.deserializeFromString(key);
    return this.addLayoutToCache(layout, key);
  }

  createLayout(attribBuffers: GPUVertexBufferLayout[], topology: GPUPrimitiveTopology, indexFormat: GPUIndexFormat = 'uint32'): Readonly<GeometryLayout> {
    const buffers = [];
    // Copy the attribBuffers, because the GeometryLayout will take ownership of them.
    for (const buffer of attribBuffers) {
      const attributes = [];
      for (const attrib of buffer.attributes) {
        attributes.push({
          shaderLocation: attrib.shaderLocation,
          format: attrib.format,
          offset: attrib.offset,
        });
      }

      buffers.push({
        arrayStride: buffer.arrayStride,
        attributes
      });
    }

    const layout = new GeometryLayout(buffers, topology, indexFormat);
    const key = layout.serializeToString();
    const id = this.#keyMap.get(key);

    if (id !== undefined) {
      return this.#cache.get(id);
    }

    return this.addLayoutToCache(layout, key);
  }
}
