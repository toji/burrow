import { WebGpuTextureLoader } from "../../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js";
import { cameraStruct } from "../shaders/common.js";

const msdfTextShader = /*wgsl*/`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

  const pos : array<vec2f, 4> = array<vec2f, 4>(
    vec2f(-1, 1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, -1)
  );

  struct VertexInput {
    @builtin(vertex_index) vertex : u32,
    @builtin(instance_index) instance : u32,
  };

  struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoord : vec2f,
  };

  struct Char {
    offset: vec2f,
    size: vec2f,
  };

  @group(1) @binding(2) var<storage> chars: array<Char>;

  @vertex
  fn vertexMain(input : VertexInput) -> VertexOutput {
    let char = chars[input.instance];
    let charPos = pos[input.vertex] * char.size + vec2(f32(input.instance) * 0.1, 0);

    var output : VertexOutput;
    output.position = camera.projection * camera.view * vec4f(charPos, 0, 1);

    output.texcoord = pos[input.vertex] * vec2f(1, -1) * 0.5 + 0.5;
    output.texcoord *= char.size;
    output.texcoord += char.offset;
    return output;
  }

  @group(1) @binding(0) var fontTexture: texture_2d<f32>;
  @group(1) @binding(1) var fontSampler: sampler;



  fn sampleMsdf(texcoord: vec2f) -> f32 {
    let c = textureSample(fontTexture, fontSampler, texcoord);
    return max(min(c.r, c.g), min(max(c.r, c.g), c.b));
  }

  @fragment
  fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
    let alpha = step(0.5, sampleMsdf(input.texcoord));
    if (alpha < 0.001) {
      discard;
    }

    return vec4(1, 1, 1, alpha);
  }

  // Technique from https://drewcassidy.me/2020/06/26/sdf-antialiasing/
  @fragment
  fn fragmentMainAntialias(input : VertexOutput) -> @location(0) vec4f {
    let dist = 0.5 - sampleMsdf(input.texcoord);

    // sdf distance per pixel (gradient vector)
    let ddist = vec2f(dpdx(dist), dpdy(dist));

    // distance to edge in pixels (scalar)
    let pixelDist = dist / length(ddist);

    let alpha = saturate(0.5 - pixelDist);
    if (alpha < 0.001) {
      discard;
    }

    return vec4(1, 1, 1, alpha);
  }
`;

export class MsdfTextRenderer {
  bindGroupLayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;
  fontTexture: GPUTexture;
  charCount: number;

  constructor(public device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    this.sampler = device.createSampler({
      label: 'msdf text sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 16,
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'msdf text group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      }, {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }, {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' }
      }]
    });

    const shaderModule = device.createShaderModule({
      label: 'msdf text shader',
      code: msdfTextShader,
    });

    device.createRenderPipelineAsync({
      label: `msdf text pipeline`,
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          frameBindGroupLayout,
          this.bindGroupLayout
        ]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMainAntialias',
        targets: [{
          format: colorFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one'
            }
          }
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32'
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less',
        format: depthFormat,
      }
    }).then((pipeline) => {
      this.pipeline = pipeline;
    });
  }

  async setFont(fontJsonUrl: string, textureLoader: WebGpuTextureLoader) {
    const response = await fetch(fontJsonUrl);
    const json = await response.json();

    const i = fontJsonUrl.lastIndexOf('/');
    const baseUrl = (i !== -1) ? fontJsonUrl.substring(0, i + 1) : undefined;

    const pagePromises = [];
    for (const pageUrl of json.pages) {
      pagePromises.push(textureLoader.fromUrl(baseUrl + pageUrl, { mipmaps: false }));
    }

    const chars = json.chars;
    this.charCount = chars.length;
    const charsBuffer = this.device.createBuffer({
      label: 'character layout buffer',
      size: this.charCount * Float32Array.BYTES_PER_ELEMENT * 4,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });

    const charsArray = new Float32Array(charsBuffer.getMappedRange());

    const w = 1 / json.common.scaleW;
    const h = 1 / json.common.scaleH;

    let offset = 0;
    for (const char of chars) {
      charsArray[offset] = char.x * w;
      charsArray[offset+1] = char.y * h;
      charsArray[offset+2] = char.width * w;
      charsArray[offset+3] = char.height * h;
      offset += 4;
    }

    charsBuffer.unmap();

    const pageTextures = await Promise.all(pagePromises);

    this.bindGroup = this.device.createBindGroup({
      label: 'msdf text font bind group',
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: pageTextures[0].createView({ baseMipLevel: 0, mipLevelCount: 1 }),
      }, {
        binding: 1,
        resource: this.sampler,
      }, {
        binding: 2,
        resource: { buffer: charsBuffer },
      }]
    });
  }

  render(renderPass: GPURenderPassEncoder) {
    if (this.bindGroup && this.pipeline) {
      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(1, this.bindGroup);
      renderPass.draw(4, this.charCount);
    }
  }
}
