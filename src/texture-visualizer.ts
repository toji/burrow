// Mostly lifted from https://github.com/webgpu/webgpu-debugger/blob/main/src/ui/components/TextureLevelViewer/TextureRenderer.ts
// Because I didn't feel like re-writing code that I had already written.

export const TextureTypes: Record<GPUTextureFormat, string> = {
  rg8unorm: 'color',
  rgba8unorm: 'color',
  'rgba8unorm-srgb': 'color',
  bgra8unorm: 'color',
  rgba16float: 'color',
  rgba32float: 'color',

  rgb10a2unorm: 'color',

  depth16unorm: 'depth',
  depth32float: 'depth',
  'depth24plus-stencil8': 'depth-stencil',
  depth24plus: 'depth',
};

export class TextureVisualizer {
  device: GPUDevice;
  pipelines: Map<string, GPURenderPipeline> = new Map<string, GPURenderPipeline>();
  sampler: GPUSampler;
  uniformBuffer: GPUBuffer;

  constructor(device: GPUDevice, colorFormat: GPUTextureFormat = null, depthFormat: GPUTextureFormat = null) {
      this.device = device;
      const shaderModule = device.createShaderModule({
          code: `
          var<private> pos : array<vec2<f32>, 4> = array<vec2<f32>, 4>(
              vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, 1.0),
              vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0)
          );

          struct VertexOut {
              @builtin(position) position : vec4<f32>,
              @location(0) texCoord : vec2<f32>,
          };

          @vertex
          fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
              let p = pos[vertexIndex];
              var output : VertexOut;
              output.position = vec4<f32>(p, 0.0, 1.0);
              output.texCoord = (vec2(p.x, -p.y) + vec2(1.0)) * vec2(0.5);
              return output;
          }

          struct Uniforms {
              range: vec2<f32>
          };
          @group(0) @binding(2) var<uniform> uniforms : Uniforms;

          @group(0) @binding(0) var imgSampler : sampler;

          fn hueToRgb(hue : f32) -> vec3<f32> {
              let hueFract = fract(hue);
              let rgb = vec3<f32>(
                  abs(hueFract * 6.0 - 3.0) - 1.0,
                  2.0 - abs(hueFract * 6.0 - 2.0),
                  2.0 - abs(hueFract * 6.0 - 4.0));
              return saturate(rgb);
          }

          @group(0) @binding(1) var img : texture_2d<f32>;
          @fragment
          fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              return textureSample(img, imgSampler, texCoord);
          }

          @group(0) @binding(1) var depthImg : texture_depth_2d;
          @fragment
          fn depthFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              let depth = (textureSample(depthImg, imgSampler, texCoord) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
              return vec4(depth, depth, depth, 1.0);
          }

          @group(0) @binding(1) var stencilImg : texture_2d<u32>;
          @fragment
          fn stencilFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(stencilImg)));
              var stencil = (f32(textureLoad(stencilImg, sampleCoord, 0).x) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
              if (stencil == 0.0) {
                  return vec4(0.0, 0.0, 0.0, 1.0);
              } else {
                  return vec4(hueToRgb(stencil), 1.0);
              }
          }

          @group(0) @binding(1) var multiImg : texture_multisampled_2d<f32>;
          @fragment
          fn multiFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              let sampleCount = i32(textureNumSamples(multiImg));
              let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiImg)));

              var accumValue : vec4<f32>;
              for (var i = 0i; i < sampleCount; i += 1i) {
                  accumValue += textureLoad(multiImg, sampleCoord, i);
              }
              return accumValue / f32(sampleCount);
          }

          @group(0) @binding(1) var multiDepthImg : texture_depth_multisampled_2d;
          @fragment
          fn multiDepthFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              let sampleCount = i32(textureNumSamples(multiDepthImg));
              let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiDepthImg)));

              var accumValue : f32;
              for (var i = 0i; i < sampleCount; i += 1i) {
                  accumValue += (textureLoad(multiDepthImg, sampleCoord, i) - uniforms.range.x) / (uniforms.range.y - uniforms.range.x);
              }

              let depth = accumValue / f32(sampleCount);
              return vec4(depth, depth, depth, 1.0);
          }

          @group(0) @binding(1) var multiStencilImg : texture_multisampled_2d<u32>;
          @fragment
          fn multiStencilFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
              let sampleCount = i32(textureNumSamples(multiStencilImg));
              let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiStencilImg)));

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

      const vertex: GPUVertexState = {
          module: shaderModule,
          entryPoint: 'vertexMain',
      };
      const primitive: GPUPrimitiveState = {
          topology: 'triangle-strip',
      };
      const targets: GPUColorTargetState[] = [
          {
              format: colorFormat || navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                  color: {
                      srcFactor: 'src-alpha',
                      dstFactor: 'one-minus-src-alpha',
                  },
                  alpha: {
                      srcFactor: 'one',
                      dstFactor: 'zero',
                  },
              },
          },
      ];

      let depthStencil: GPUDepthStencilState = undefined;
      if (depthFormat) {
        depthStencil = {
          format: depthFormat,
          depthWriteEnabled: false,
          depthCompare: 'always',
        };
      }

      this.pipelines.set(
          'color',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'fragmentMain',
                  targets,
              },
          })
      );

      this.pipelines.set(
          'depth',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'depthFragmentMain',
                  targets,
              },
          })
      );

      this.pipelines.set(
          'stencil',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'stencilFragmentMain',
                  targets,
              },
          })
      );

      this.pipelines.set(
          'multisampled-color',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'multiFragmentMain',
                  targets,
              },
          })
      );

      this.pipelines.set(
          'multisampled-depth',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'multiDepthFragmentMain',
                  targets,
              },
          })
      );

      this.pipelines.set(
          'multisampled-stencil',
          device.createRenderPipeline({
              layout: 'auto',
              vertex,
              primitive,
              depthStencil,
              fragment: {
                  module: shaderModule,
                  entryPoint: 'multiStencilFragmentMain',
                  targets,
              },
          })
      );

      this.sampler = device.createSampler({});
      this.uniformBuffer = device.createBuffer({
          size: Float32Array.BYTES_PER_ELEMENT * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      });
  }

  render(
      renderPass: GPURenderPassEncoder,
      texture: GPUTexture,
      mipLevel: number = 0,
      layer: number = 0,
      rangeMin: number = 0,
      rangeMax: number = 1,
      aspect: GPUTextureAspect = 'all'
  ) {
      let formatType = TextureTypes[texture.format];
      if (!formatType) {
        console.warn(`No texture type information for ${texture.format}`);
        return;
      }

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
      const type = (texture.sampleCount > 1 ? 'multisampled-' : '') + formatType;

      const pipeline = this.pipelines.get(type);
      let bindGroup: GPUBindGroup;

      const uniformArray = new Float32Array(this.uniformBuffer.size / Float32Array.BYTES_PER_ELEMENT);
      // Range
      uniformArray[0] = rangeMin;
      uniformArray[1] = rangeMax;

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

      if (pipeline) {
          const entries: Array<GPUBindGroupEntry> = [
              {
                  binding: 1,
                  resource: texture.createView({
                      dimension: '2d',
                      aspect,
                      baseMipLevel: mipLevel,
                      mipLevelCount: 1,
                      baseArrayLayer: layer,
                      arrayLayerCount: 1,
                  }),
              },
          ];

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
      } else {
          console.warn(`No approprate pipeline found for texture type "${type}"`);
      }

      if (pipeline && bindGroup) {
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setPipeline(pipeline);
        renderPass.draw(4);
      }
  }
}