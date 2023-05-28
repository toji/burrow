import { Mat4Like } from "gl-matrix";
import { WebGpuTextureLoader } from "../../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js";

const msdfTextShader = /*wgsl*/`
  const pos : array<vec2f, 4> = array<vec2f, 4>(
    vec2f(0, -1), vec2f(1, -1), vec2f(0, 0), vec2f(1, 0)
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
    texOffset: vec2f,
    size: vec2f,
    offset: vec2f,
    texPage: f32,
  };

  struct Camera {
    projection: mat4x4f,
    view: mat4x4f,
  };

  @group(0) @binding(2) var<storage> chars: array<Char>;

  @group(1) @binding(0) var<uniform> camera: Camera;
  @group(1) @binding(1) var<storage> text: array<vec3f>;

  @vertex
  fn vertexMain(input : VertexInput) -> VertexOutput {
    let textElement = text[input.instance];
    let char = chars[u32(textElement.z)];
    let charPos = pos[input.vertex] * char.size + textElement.xy + char.offset;

    var output : VertexOutput;
    output.position = camera.projection * camera.view * vec4f(charPos, 0, 1);

    output.texcoord = pos[input.vertex] * vec2f(1, -1);
    output.texcoord *= char.size;
    output.texcoord += char.texOffset;
    return output;
  }

  @group(0) @binding(0) var fontTexture: texture_2d<f32>;
  @group(0) @binding(1) var fontSampler: sampler;

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

  // Antialiasing technique from https://drewcassidy.me/2020/06/26/sdf-antialiasing/
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

type KerningMap = Map<number, Map<number, number>>;

export class MsdfFont {
  charCount: number;
  defaultChar: any;
  constructor(public bindGroup: GPUBindGroup, public lineHeight: number,
              public chars: { [x: number]: any }, public kernings: KerningMap) {
    const charArray = Object.values(chars);
    this.charCount = charArray.length;
    this.defaultChar = charArray[0];
  }

  getChar(charCode: number): any {
    let char = this.chars[charCode];
    if (!char) { char = this.defaultChar; }
    return char;
  }
};

export interface MsdfTextMeasurements {
  width: number,
  height: number,
  lineWidths: number[],
  printedCharCount: number,
};

export class MsdfText {
  public renderBundle: GPURenderBundle;

  constructor(public bindGroup: GPUBindGroup, public measurements: MsdfTextMeasurements, public font: MsdfFont) {}
};

export class MsdfTextRenderer {
  fontBindGroupLayout: GPUBindGroupLayout;
  textBindGroupLayout: GPUBindGroupLayout;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;
  cameraUniformBuffer: GPUBuffer;

  renderBundleDescriptor: GPURenderBundleEncoderDescriptor;
  cameraArray: Float32Array = new Float32Array(16 * 2);

  constructor(public device: GPUDevice, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    this.renderBundleDescriptor = {
      colorFormats: [colorFormat],
      depthStencilFormat: depthFormat,
    };

    this.sampler = device.createSampler({
      label: 'msdf text sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 16,
    });

    this.cameraUniformBuffer = device.createBuffer({
      label: 'msdf camera uniform buffer',
      size: this.cameraArray.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });

    this.fontBindGroupLayout = device.createBindGroupLayout({
      label: 'msdf font group layout',
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

    this.textBindGroupLayout = device.createBindGroupLayout({
      label: 'msdf text group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}
      }, {
        binding: 1,
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
          this.fontBindGroupLayout,
          this.textBindGroupLayout
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

  async createFont(fontJsonUrl: string, textureLoader: WebGpuTextureLoader): Promise<MsdfFont> {
    const response = await fetch(fontJsonUrl);
    const json = await response.json();

    const i = fontJsonUrl.lastIndexOf('/');
    const baseUrl = (i !== -1) ? fontJsonUrl.substring(0, i + 1) : undefined;

    const pagePromises = [];
    for (const pageUrl of json.pages) {
      pagePromises.push(textureLoader.fromUrl(baseUrl + pageUrl, { mipmaps: false }));
    }

    const charCount = json.chars.length;
    const charsBuffer = this.device.createBuffer({
      label: 'msdf character layout buffer',
      size: charCount * Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });

    const charsArray = new Float32Array(charsBuffer.getMappedRange());

    const w = 1 / json.common.scaleW;
    const h = 1 / json.common.scaleH;

    const chars: { [x: number]: any } = {};

    let offset = 0;
    for (const [i, char] of json.chars.entries()) {
      chars[char.id] = char;
      chars[char.id].charIndex = i;
      chars[char.id].xadvance *= w;
      charsArray[offset] = char.x * w;
      charsArray[offset+1] = char.y * h;
      charsArray[offset+2] = char.width * w;
      charsArray[offset+3] = char.height * h;
      charsArray[offset+4] = char.xoffset * w;
      charsArray[offset+5] = -char.yoffset * h;
      charsArray[offset+6] = char.page;
      offset += 8;
    }

    charsBuffer.unmap();

    const pageTextures = await Promise.all(pagePromises);

    const bindGroup = this.device.createBindGroup({
      label: 'msdf font bind group',
      layout: this.fontBindGroupLayout,
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

    const kernings = new Map();

    if (json.kernings) {
      for (const kearning of json.kernings) {
        let charKerning = kernings.get(kearning.first);
        if (!charKerning) {
          charKerning = new Map<number, number>();
          kernings.set(kearning.first, charKerning);
        }
        charKerning.set(kearning.second, kearning.amount * w);
      }
    }

    return new MsdfFont(bindGroup, json.common.lineHeight * h, chars, kernings);
  }

  formatText(font: MsdfFont, text: string, centered: boolean = false): MsdfText {
    const textBuffer = this.device.createBuffer({
      label: 'msdf text buffer',
      size: text.length * Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });

    const textArray = new Float32Array(textBuffer.getMappedRange());
    let offset = 0;

    let measurements: MsdfTextMeasurements;
    if (centered) {
      measurements = this.measureText(font, text);

      this.measureText(font, text, (textX: number, textY: number, line: number, char: any) => {
        const lineOffset = measurements.width * -0.5 - (measurements.width - measurements.lineWidths[line]) * -0.5;

        textArray[offset] = textX + lineOffset;
        textArray[offset+1] = textY + measurements.height * 0.5;
        textArray[offset+2] = char.charIndex;
        offset += 4;
      });
    } else {
      measurements = this.measureText(font, text, (textX: number, textY: number, line: number, char: any) => {
        textArray[offset] = textX;
        textArray[offset+1] = textY;
        textArray[offset+2] = char.charIndex;
        offset += 4;
      });
    }

    textBuffer.unmap();

    const bindGroup = this.device.createBindGroup({
      label: 'msdf text bind group',
      layout: this.textBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraUniformBuffer },
      }, {
        binding: 1,
        resource: { buffer: textBuffer },
      }]
    });

    return new MsdfText(bindGroup, measurements, font);
  }

  measureText(font: MsdfFont, text: string, charCallback?: (x: number, y: number, line: number, char: any) => void ): MsdfTextMeasurements {
    let maxWidth = 0;
    const lineWidths: number[] = [];

    let textOffsetX = 0;
    let textOffsetY = 0;
    let line = 0;
    let printedCharCount = 0;
    let nextCharCode = text.charCodeAt(0);
    for (let i = 0; i < text.length; ++i) {
      let charCode = nextCharCode;
      nextCharCode = i < text.length - 1 ? text.charCodeAt(i+1) : -1;

      switch(charCode) {
        case 10: // Newline
          lineWidths.push(textOffsetX);
          line++;
          maxWidth = Math.max(maxWidth, textOffsetX);
          textOffsetX = 0;
          textOffsetY -= font.lineHeight
          continue;
        case 13: // CR
          continue;
        case 32: // Space
          // For spaces, just advance the offset without actually adding a
          // character.
          let char = font.getChar(charCode);
          textOffsetX += char.xadvance;
          continue;
        default: {
          let char = font.getChar(charCode);
          if (charCallback) {
            charCallback(textOffsetX, textOffsetY, line, char);
          }

          let advance = char.xadvance;
          const kerning = font.kernings.get(charCode);
          if (kerning) {
            advance += kerning.get(nextCharCode) ?? 0;
          }

          textOffsetX += advance;
          printedCharCount++;
        }
      }
    }

    lineWidths.push(textOffsetX);
    maxWidth = Math.max(maxWidth, textOffsetX);

    return {
      width: maxWidth,
      height: lineWidths.length * font.lineHeight,
      lineWidths,
      printedCharCount,
    };
  }

  updateCamera(projection: Mat4Like, view: Mat4Like) {
    this.cameraArray.set(projection, 0);
    this.cameraArray.set(view, 16);
    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, this.cameraArray);
  }

  render(renderPass: GPURenderPassEncoder, text: MsdfText) {
    if (text && this.pipeline) {
      if (!text.renderBundle) {
        const encoder = this.device.createRenderBundleEncoder(this.renderBundleDescriptor);
        encoder.setPipeline(this.pipeline);
        encoder.setBindGroup(0, text.font.bindGroup);
        encoder.setBindGroup(1, text.bindGroup);
        encoder.draw(4, text.measurements.printedCharCount);
        text.renderBundle = encoder.finish();
      }

      renderPass.executeBundles([text.renderBundle]);
    }
  }
}
