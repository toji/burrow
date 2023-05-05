import { WebGpuTextureLoader } from "../../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js";
import { cameraStruct } from "../shaders/common.js";

const msdfTextShader = /*wgsl*/`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

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

  @group(1) @binding(2) var<storage> chars: array<Char>;

  @group(2) @binding(0) var<storage> text: array<vec3f>;

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

export class MsdfFont {
  charCount: number;
  defaultChar: any;
  constructor(public bindGroup: GPUBindGroup, public lineHeight: number, public chars: { [x: number]: any }) {
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
  constructor(public bindGroup: GPUBindGroup, public measurements: MsdfTextMeasurements, public font: MsdfFont) {}
};

export class MsdfTextRenderer {
  fontBindGroupLayout: GPUBindGroupLayout;
  textBindGroupLayout: GPUBindGroupLayout;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;

  constructor(public device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    this.sampler = device.createSampler({
      label: 'msdf text sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 16,
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

    return new MsdfFont(bindGroup, json.common.lineHeight * h, chars);
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
    for (let i = 0; i < text.length; ++i) {
      let charCode = text.charCodeAt(i);

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
          textOffsetX += char.xadvance;
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

  render(renderPass: GPURenderPassEncoder, text: MsdfText) {
    if (text && this.pipeline) {
      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(1, text.font.bindGroup);
      renderPass.setBindGroup(2, text.bindGroup);
      renderPass.draw(4, text.measurements.printedCharCount);
    }
  }
}
