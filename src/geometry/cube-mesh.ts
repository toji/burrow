interface BufferBinding {
  buffer: GPUBuffer,
  offset: number,
};

interface VertexBufferBinding extends BufferBinding {
  slot: number
};

interface IndexBufferBinding extends BufferBinding {
  format: GPUIndexFormat
};

export interface Mesh {
  vertex: VertexBufferBinding[],
  index?: IndexBufferBinding,
  drawCount: number;
}

export function createTempMesh(device: GPUDevice): Mesh {
  const vertexArray = new Float32Array([
    // float3 position, float3 color, float3 normal, float2 uv,
    1, -1, 1,    1, 0, 1,  0, -1, 0,  1, 1,
    -1, -1, 1,   1, 0, 1,  0, -1, 0,  0, 1,
    -1, -1, -1,  1, 0, 1,  0, -1, 0,  0, 0,
    1, -1, -1,   1, 0, 1,  0, -1, 0,  1, 0,
    1, -1, 1,    1, 0, 1,  0, -1, 0,  1, 1,
    -1, -1, -1,  1, 0, 1,  0, -1, 0,  0, 0,

    1, 1, 1,     1, 0, 0,  1, 0, 0,  1, 1,
    1, -1, 1,    1, 0, 0,  1, 0, 0,  0, 1,
    1, -1, -1,   1, 0, 0,  1, 0, 0,  0, 0,
    1, 1, -1,    1, 0, 0,  1, 0, 0,  1, 0,
    1, 1, 1,     1, 0, 0,  1, 0, 0,  1, 1,
    1, -1, -1,   1, 0, 0,  1, 0, 0,  0, 0,

    -1, 1, 1,    0, 1, 0,  0, 1, 0,  1, 1,
    1, 1, 1,     0, 1, 0,  0, 1, 0,  0, 1,
    1, 1, -1,    0, 1, 0,  0, 1, 0,  0, 0,
    -1, 1, -1,   0, 1, 0,  0, 1, 0,  1, 0,
    -1, 1, 1,    0, 1, 0,  0, 1, 0,  1, 1,
    1, 1, -1,    0, 1, 0,  0, 1, 0,  0, 0,

    -1, -1, 1,   0, 1, 1,  -1, 0, 0,  1, 1,
    -1, 1, 1,    0, 1, 1,  -1, 0, 0,  0, 1,
    -1, 1, -1,   0, 1, 1,  -1, 0, 0,  0, 0,
    -1, -1, -1,  0, 1, 1,  -1, 0, 0,  1, 0,
    -1, -1, 1,   0, 1, 1,  -1, 0, 0,  1, 1,
    -1, 1, -1,   0, 1, 1,  -1, 0, 0,  0, 0,

    1, 1, 1,     0, 0, 1,  0, 0, 1,  1, 1,
    -1, 1, 1,    0, 0, 1,  0, 0, 1,  0, 1,
    -1, -1, 1,   0, 0, 1,  0, 0, 1,  0, 0,
    -1, -1, 1,   0, 0, 1,  0, 0, 1,  0, 0,
    1, -1, 1,    0, 0, 1,  0, 0, 1,  1, 0,
    1, 1, 1,     0, 0, 1,  0, 0, 1,  1, 1,

    1, -1, -1,   1, 1, 0,  0, 0, -1,  1, 1,
    -1, -1, -1,  1, 1, 0,  0, 0, -1,  0, 1,
    -1, 1, -1,   1, 1, 0,  0, 0, -1,  0, 0,
    1, 1, -1,    1, 1, 0,  0, 0, -1,  1, 0,
    1, -1, -1,   1, 1, 0,  0, 0, -1,  1, 1,
    -1, 1, -1,   1, 1, 0,  0, 0, -1,  0, 0,
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

  return {
    vertex: [{
      slot: 0,
      buffer: vertexBuffer,
      offset: 0
    }],
    drawCount: 36,
  };
}