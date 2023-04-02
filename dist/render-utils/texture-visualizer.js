// Mostly lifted from https://github.com/webgpu/webgpu-debugger/blob/main/src/ui/components/TextureLevelViewer/TextureRenderer.ts
// Because I didn't feel like re-writing code that I had already written.
function getTextureType(format) {
    if (format.includes('depth')) {
        return format.includes('stencil') ? 'depth-stencil' : 'depth';
    }
    else if (format.includes('stencil')) {
        return 'stencil';
    }
    else {
        return 'color';
    }
}
export class TextureVisualizer {
    device;
    pipelines = new Map();
    sampler;
    uniformBuffer;
    constructor(device, colorFormat = null, depthFormat = null) {
        this.device = device;
        const shaderModule = device.createShaderModule({
            code: `
        const pos : array<vec2f, 3> = array<vec2f, 3>(
          vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

        struct VertexOut {
          @builtin(position) position : vec4f,
          @location(0) texCoord : vec2f,
        };

        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
          let p = pos[vertexIndex];
          var output : VertexOut;
          output.position = vec4f(p, 0.0, 1.0);
          output.texCoord = (vec2(p.x, -p.y) + 1) * 0.5;
          return output;
        }

        struct Uniforms {
          range: vec2f
        };
        @group(0) @binding(2) var<uniform> uniforms : Uniforms;

        @group(0) @binding(0) var imgSampler : sampler;

        fn hueToRgb(hue : f32) -> vec3f {
          let hueFract = fract(hue);
          let rgb = vec3f(
              abs(hueFract * 6.0 - 3.0) - 1.0,
              2.0 - abs(hueFract * 6.0 - 2.0),
              2.0 - abs(hueFract * 6.0 - 4.0));
          return saturate(rgb);
        }

        @group(0) @binding(1) var img : texture_2d<f32>;
        @fragment
        fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            return textureSample(img, imgSampler, texCoord);
        }

        @fragment
        fn fragmentMainAlpha(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            return vec4f(textureSample(img, imgSampler, texCoord).aaa, 1);
        }

        @group(0) @binding(1) var depthImg : texture_depth_2d;
        @fragment
        fn depthFragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            let depth = (textureSample(depthImg, imgSampler, texCoord) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
            return vec4(depth, depth, depth, 1.0);
        }

        @group(0) @binding(1) var stencilImg : texture_2d<u32>;
        @fragment
        fn stencilFragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            let sampleCoord = vec2<i32>(texCoord * vec2f(textureDimensions(stencilImg)));
            var stencil = (f32(textureLoad(stencilImg, sampleCoord, 0).x) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
            if (stencil == 0.0) {
                return vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                return vec4(hueToRgb(stencil), 1.0);
            }
        }

        @group(0) @binding(1) var multiImg : texture_multisampled_2d<f32>;
        @fragment
        fn multiFragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            let sampleCount = i32(textureNumSamples(multiImg));
            let sampleCoord = vec2<i32>(texCoord * vec2f(textureDimensions(multiImg)));

            var accumValue : vec4f;
            for (var i = 0i; i < sampleCount; i += 1i) {
                accumValue += textureLoad(multiImg, sampleCoord, i);
            }
            return accumValue / f32(sampleCount);
        }

        @fragment
        fn multiFragmentMainAlpha(@location(0) texCoord : vec2f) -> @location(0) vec4f {
          let sampleCount = i32(textureNumSamples(multiImg));
          let sampleCoord = vec2<i32>(texCoord * vec2f(textureDimensions(multiImg)));

          var accumValue : vec4f;
          for (var i = 0i; i < sampleCount; i += 1i) {
              accumValue += textureLoad(multiImg, sampleCoord, i);
          }
          return vec4(accumValue.aaa, 1) / f32(sampleCount);
      }

        @group(0) @binding(1) var multiDepthImg : texture_depth_multisampled_2d;
        @fragment
        fn multiDepthFragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            let sampleCount = i32(textureNumSamples(multiDepthImg));
            let sampleCoord = vec2<i32>(texCoord * vec2f(textureDimensions(multiDepthImg)));

            var accumValue : f32;
            for (var i = 0i; i < sampleCount; i += 1i) {
                accumValue += (textureLoad(multiDepthImg, sampleCoord, i) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
            }

            let depth = accumValue / f32(sampleCount);
            return vec4(depth, depth, depth, 1.0);
        }

        @group(0) @binding(1) var multiStencilImg : texture_multisampled_2d<u32>;
        @fragment
        fn multiStencilFragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
            let sampleCount = i32(textureNumSamples(multiStencilImg));
            let sampleCoord = vec2<i32>(texCoord * vec2f(textureDimensions(multiStencilImg)));

            var accumValue : f32;
            for (var i = 0i; i < sampleCount; i += 1i) {
                accumValue += (f32(textureLoad(multiStencilImg, sampleCoord, i).x) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
            }

            let stencil = accumValue / f32(sampleCount);
            if (stencil == 0.0) {
                return vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                return vec4(hueToRgb(stencil), 1.0);
            }
        }
      `,
        });
        const vertex = {
            module: shaderModule,
            entryPoint: 'vertexMain',
        };
        const targets = [{
                format: colorFormat || navigator.gpu.getPreferredCanvasFormat(),
                blend: {
                    color: {
                        srcFactor: 'one',
                        dstFactor: 'zero',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'zero',
                    },
                },
            }];
        let depthStencil = undefined;
        if (depthFormat) {
            depthStencil = {
                format: depthFormat,
                depthWriteEnabled: false,
                depthCompare: 'always',
            };
        }
        const createRenderPipeline = (entryPoint) => {
            return device.createRenderPipeline({
                layout: 'auto',
                vertex,
                depthStencil,
                fragment: {
                    module: shaderModule,
                    entryPoint,
                    targets,
                },
            });
        };
        this.pipelines.set('color', createRenderPipeline('fragmentMain'));
        this.pipelines.set('alpha', createRenderPipeline('fragmentMainAlpha'));
        this.pipelines.set('depth', createRenderPipeline('depthFragmentMain'));
        this.pipelines.set('stencil', createRenderPipeline('stencilFragmentMain'));
        this.pipelines.set('multisampled-color', createRenderPipeline('multiFragmentMain'));
        this.pipelines.set('multisampled-alpha', createRenderPipeline('multiFragmentMainAlpha'));
        this.pipelines.set('multisampled-depth', createRenderPipeline('multiDepthFragmentMain'));
        this.pipelines.set('multisampled-stencil', createRenderPipeline('multiStencilFragmentMain'));
        this.sampler = device.createSampler({});
        this.uniformBuffer = device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }
    render(renderPass, texture, mipLevel = 0, layer = 0, rangeMin = 0, rangeMax = 1, aspect = 'all', alphaOnly = false) {
        let formatType = getTextureType(texture.format);
        if (formatType === 'depth-stencil') {
            switch (aspect) {
                case 'depth-only':
                    formatType = 'depth';
                    break;
                case 'stencil-only':
                    formatType = 'stencil';
                    break;
                default:
                    throw new Error(`Cannot render a ${formatType} texture with an aspect of ${aspect}`);
            }
        }
        else if (alphaOnly) {
            formatType = 'alpha';
        }
        const type = (texture.sampleCount > 1 ? 'multisampled-' : '') + formatType;
        const pipeline = this.pipelines.get(type);
        let bindGroup;
        const uniformArray = new Float32Array(this.uniformBuffer.size / Float32Array.BYTES_PER_ELEMENT);
        // Range
        uniformArray[0] = rangeMin;
        uniformArray[1] = rangeMax;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);
        if (pipeline) {
            const entries = [{
                    binding: 1,
                    resource: texture.createView({
                        dimension: '2d',
                        aspect,
                        baseMipLevel: mipLevel,
                        mipLevelCount: 1,
                        baseArrayLayer: layer,
                        arrayLayerCount: 1,
                    }),
                }];
            if (texture.sampleCount === 1) {
                entries.push({
                    binding: 0,
                    resource: this.sampler,
                });
            }
            if (formatType === 'depth' || formatType === 'stencil') {
                entries.push({
                    binding: 2,
                    resource: { buffer: this.uniformBuffer },
                });
            }
            bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries,
            });
        }
        else {
            console.warn(`No approprate pipeline found for texture type "${type}"`);
        }
        if (pipeline && bindGroup) {
            renderPass.setBindGroup(0, bindGroup);
            renderPass.setPipeline(pipeline);
            renderPass.draw(3);
        }
    }
}
//# sourceMappingURL=texture-visualizer.js.map