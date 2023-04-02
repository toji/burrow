importScripts('../worker-pool-service.js');
importScripts('https://www.gstatic.com/draco/versioned/decoders/1.5.2/draco_decoder_gltf.js');

const DRACO_DECODER = new Promise((resolve) => {
  DracoDecoderModule({
    onModuleLoaded: (draco) => {
      resolve(draco);
    }
  });
});

class DracoDecoderService extends WorkerPoolService {
  async init() {
    this.draco = await DRACO_DECODER;
    this.decoder = new this.draco.Decoder();
  }

  async onDispatch(args) {
    const dracoBuffer = new Int8Array(args.buffer);
    const dracoAttributes = args.attributes;
    const indexSize = args.indexSize;

    const geometryType = this.decoder.GetEncodedGeometryType(dracoBuffer);

    let geometry;
    let status;
    switch (geometryType) {
      case this.draco.POINT_CLOUD: {
        geometry = new this.draco.PointCloud();
        status = this.decoder.DecodeArrayToPointCloud(dracoBuffer, dracoBuffer.byteLength, geometry);
        break;
      }
      case this.draco.TRIANGULAR_MESH: {
        geometry = new this.draco.Mesh();
        status = this.decoder.DecodeArrayToMesh(dracoBuffer, dracoBuffer.byteLength, geometry);
        break;
      }
      default:
        throw new Error('Unknown Draco geometry type');
    }

    if (!status.ok()) {
      throw new Error('Draco decode failed');
    }

    const bufferViews = {};
    const attributes = {};

    const vertCount = geometry.num_points();

    let totalByteLength = 0;
    let byteOffset = 0;

    // Do a quick pre-pass to determine the total buffer length that needs to be allocated.
    for (const name in dracoAttributes) {
      const attributeId = dracoAttributes[name];
      const attribute = this.decoder.GetAttributeByUniqueId(geometry, attributeId);
      totalByteLength += vertCount * attribute.byte_stride();

      attributes[name] = attribute;
    }

    if (geometryType == this.draco.TRIANGULAR_MESH && indexSize) {
      totalByteLength += geometry.num_faces() * 3 * indexSize;
    }

    const transferBuffer = new Uint8Array(totalByteLength);

    for (const name in attributes) {
      const attribute = attributes[name];
      const byteStride = attribute.byte_stride();
      const byteLength = vertCount * byteStride;
      const outPtr = this.draco._malloc(byteLength);
      const success = this.decoder.GetAttributeDataArrayForAllPoints(
          geometry, attribute, attribute.data_type(), byteLength, outPtr);
      if (!success) {
        throw new Error('Failed to get decoded attribute data array');
      }

      // Copy the decoded attribute data out of the WASM heap.
      transferBuffer.set(new Uint8Array(this.draco.HEAPF32.buffer, outPtr, byteLength), byteOffset);
      bufferViews[name] = {
        byteOffset,
        byteLength,
        byteStride,
      };

      byteOffset += byteLength;

      this.draco._free(outPtr);
    }

    if (geometryType == this.draco.TRIANGULAR_MESH && indexSize) {
      const indexCount = geometry.num_faces() * 3;
      const byteLength = indexCount * indexSize;
      const outPtr = this.draco._malloc(byteLength);
      let success;
      if (indexSize == 4) {
        success = this.decoder.GetTrianglesUInt32Array(geometry, byteLength, outPtr);
      } else {
        success = this.decoder.GetTrianglesUInt16Array(geometry, byteLength, outPtr);
      }

      if (!success) {
        throw new Error('Failed to get decoded index data array');
      }

      // Copy the decoded index data out of the WASM heap.
      transferBuffer.set(new Uint8Array(this.draco.HEAPF32.buffer, outPtr, byteLength), byteOffset);
      bufferViews.INDICES = {
        byteOffset,
        byteLength,
        byteStride: indexSize,
      };
      byteOffset += byteLength;

      this.draco._free(outPtr);
    }

    return this.transfer({ buffer: transferBuffer.buffer, bufferViews }, [transferBuffer.buffer]);
  }
}

// Initialize the service
new DracoDecoderService();