import { Mat4 } from "../../../node_modules/gl-matrix/dist/esm/index.js";
const msdfTextShader = /*wgsl*/ `
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
    texExtent: vec2f,
    size: vec2f,
    offset: vec2f,
  };

  struct FormattedText {
    model: mat4x4f,
    scale: f32,
    chars: array<vec3f>,
  };

  struct Camera {
    projection: mat4x4f,
    view: mat4x4f,
  };

  @group(0) @binding(2) var<storage> chars: array<Char>;

  @group(1) @binding(0) var<uniform> camera: Camera;
  @group(1) @binding(1) var<storage> text: FormattedText;

  @vertex
  fn vertexMain(input : VertexInput) -> VertexOutput {
    let textElement = text.chars[input.instance];
    let char = chars[u32(textElement.z)];
    let charPos = (pos[input.vertex] * char.size + textElement.xy + char.offset) * text.scale;

    var output : VertexOutput;
    output.position = camera.projection * camera.view * text.model * vec4f(charPos, 0, 1);

    output.texcoord = pos[input.vertex] * vec2f(1, -1);
    output.texcoord *= char.texExtent;
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

    return vec4f(1, 1, 1, alpha);
  }
`;
export class MsdfFont {
    bindGroup;
    lineHeight;
    chars;
    kernings;
    charCount;
    defaultChar;
    constructor(bindGroup, lineHeight, chars, kernings) {
        this.bindGroup = bindGroup;
        this.lineHeight = lineHeight;
        this.chars = chars;
        this.kernings = kernings;
        const charArray = Object.values(chars);
        this.charCount = charArray.length;
        this.defaultChar = charArray[0];
    }
    getChar(charCode) {
        let char = this.chars[charCode];
        if (!char) {
            char = this.defaultChar;
        }
        return char;
    }
    // Gets the distance in pixels a line should advance for a given character code. If the upcoming
    // character code is given any kerning between the two characters will be taken into account.
    getXAdvance(charCode, nextCharCode = -1) {
        const char = this.getChar(charCode);
        if (nextCharCode >= 0) {
            const kerning = this.kernings.get(charCode);
            if (kerning) {
                return char.xadvance + (kerning.get(nextCharCode) ?? 0);
            }
        }
        return char.xadvance;
    }
}
;
;
export class MsdfText {
    device;
    bindGroup;
    measurements;
    font;
    textBuffer;
    renderBundle;
    constructor(device, bindGroup, measurements, font, textBuffer) {
        this.device = device;
        this.bindGroup = bindGroup;
        this.measurements = measurements;
        this.font = font;
        this.textBuffer = textBuffer;
    }
    setTransform(matrix) {
        this.device.queue.writeBuffer(this.textBuffer, 0, matrix, 0, 16);
    }
}
;
;
export class MsdfTextRenderer {
    device;
    fontBindGroupLayout;
    textBindGroupLayout;
    pipeline;
    sampler;
    cameraUniformBuffer;
    renderBundleDescriptor;
    cameraArray = new Float32Array(16 * 2);
    constructor(device, colorFormat, depthFormat) {
        this.device = device;
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
    async createFont(fontJsonUrl, textureLoader) {
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
        const u = 1 / json.common.scaleW;
        const v = 1 / json.common.scaleH;
        const chars = {};
        let offset = 0;
        for (const [i, char] of json.chars.entries()) {
            chars[char.id] = char;
            chars[char.id].charIndex = i;
            //chars[char.id].xadvance *= w;
            charsArray[offset] = char.x * u; // texOffset.x
            charsArray[offset + 1] = char.y * v; // texOffset.y
            charsArray[offset + 2] = char.width * u; // texExtent.x
            charsArray[offset + 3] = char.height * v; // texExtent.y
            charsArray[offset + 4] = char.width; // size.x
            charsArray[offset + 5] = char.height; // size.y
            charsArray[offset + 6] = char.xoffset; // offset.x
            charsArray[offset + 7] = -char.yoffset; // offset.y
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
                    charKerning = new Map();
                    kernings.set(kearning.first, charKerning);
                }
                charKerning.set(kearning.second, kearning.amount);
            }
        }
        return new MsdfFont(bindGroup, json.common.lineHeight, chars, kernings);
    }
    formatText(font, text, options = {}) {
        const textBuffer = this.device.createBuffer({
            label: 'msdf text buffer',
            size: (text.length + 5) * Float32Array.BYTES_PER_ELEMENT * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        const textArray = new Float32Array(textBuffer.getMappedRange());
        Mat4.identity(textArray);
        textArray[16] = options.pixelScale ?? (1 / 512);
        let offset = 20;
        let measurements;
        if (options.centered) {
            measurements = this.measureText(font, text);
            this.measureText(font, text, (textX, textY, line, char) => {
                const lineOffset = measurements.width * -0.5 - (measurements.width - measurements.lineWidths[line]) * -0.5;
                textArray[offset] = textX + lineOffset;
                textArray[offset + 1] = textY + measurements.height * 0.5;
                textArray[offset + 2] = char.charIndex;
                offset += 4;
            });
        }
        else {
            measurements = this.measureText(font, text, (textX, textY, line, char) => {
                textArray[offset] = textX;
                textArray[offset + 1] = textY;
                textArray[offset + 2] = char.charIndex;
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
        return new MsdfText(this.device, bindGroup, measurements, font, textBuffer);
    }
    measureText(font, text, charCallback) {
        let maxWidth = 0;
        const lineWidths = [];
        let textOffsetX = 0;
        let textOffsetY = 0;
        let line = 0;
        let printedCharCount = 0;
        let nextCharCode = text.charCodeAt(0);
        for (let i = 0; i < text.length; ++i) {
            let charCode = nextCharCode;
            nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;
            switch (charCode) {
                case 10: // Newline
                    lineWidths.push(textOffsetX);
                    line++;
                    maxWidth = Math.max(maxWidth, textOffsetX);
                    textOffsetX = 0;
                    textOffsetY -= font.lineHeight;
                case 13: // CR
                    break;
                case 32: // Space
                    // For spaces, advance the offset without actually adding a character.
                    textOffsetX += font.getXAdvance(charCode);
                    break;
                default: {
                    if (charCallback) {
                        charCallback(textOffsetX, textOffsetY, line, font.getChar(charCode));
                    }
                    textOffsetX += font.getXAdvance(charCode, nextCharCode);
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
    updateCamera(projection, view) {
        this.cameraArray.set(projection, 0);
        this.cameraArray.set(view, 16);
        this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, this.cameraArray);
    }
    render(renderPass, text) {
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
//# sourceMappingURL=msdf-text.js.map