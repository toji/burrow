import { cameraStruct } from "../shaders/common.js";
import { Vec3 } from '../../../node_modules/gl-matrix/dist/esm/index.js';

const SSAO_SAMPLES = 8;
const SSAO_NOISE_VALUES = 16;

const UNIT_VEC_Z = new Vec3(0, 0, 1);

const BLUR_TARGET_FORMAT = 'r8unorm';

const SSAO_SHADER = /*wgsl*/`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera: Camera;

  const pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(1) @binding(0) var depthTexture: texture_depth_2d;
  @group(1) @binding(1) var normalTexture: texture_2d<f32>;
  @group(1) @binding(2) var ssaoSampler: sampler;

  struct SsaoSamples {
    sampleCount: u32,
    noise: array<vec3f, ${SSAO_NOISE_VALUES}>,
    samples: array<vec3f>,
  }
  @group(1) @binding(3) var<storage> ssao: SsaoSamples;

  // TODO: Make these uniforms?
  const sampleRadius = 0.05;
  const sampleBias = 0.005;

  fn viewPosFromDepth(texcoord: vec2f, depth: f32) -> vec3f {
    let clipSpacePos = vec4f((texcoord * 2 - 1) * vec2f(1, -1), depth, 1);
    let viewPos = camera.invProjection * clipSpacePos;
    return (viewPos.xyz / viewPos.w);
  }

  fn linearDepth(depthSample : f32) -> f32 {
    return camera.zRange[1] * camera.zRange[0] / fma(depthSample, camera.zRange[0]-camera.zRange[1], camera.zRange[1]);
  }

  @fragment
  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = (1 / vec2f(textureDimensions(depthTexture)));
    let texcoord = pos.xy * texelSize;

    let worldNorm = normalize(2 * textureLoad(normalTexture, vec2u(pos.xy), 0).xyz - 1);
    let normal = normalize((camera.view * vec4f(worldNorm, 0)).xyz); // View space

    let randomVec = ssao.noise[(u32(pos.x) % 4) + ((u32(pos.y) % 4) * 4)];
    let tangent = normalize(randomVec - normal * dot(randomVec, normal));
    let bitangent = cross(normal, tangent);
    let tbn = mat3x3f(tangent, bitangent, normal);

    let depth = textureLoad(depthTexture, vec2u(pos.xy), 0);
    let viewPos = viewPosFromDepth(texcoord, depth);
    let viewDepth = linearDepth(depth);

    var ao = 0.0;
    for (var i = 0u; i < ssao.sampleCount; i++) {
      let samplePos = viewPos + (tbn * ssao.samples[i] * sampleRadius);
      let offset = camera.projection * vec4f(samplePos, 1);
      let offsetCoord = ((offset.xy / offset.w) * vec2f(1, -1) * 0.5 + 0.5);
      let sampleDepth = textureSample(depthTexture, ssaoSampler, offsetCoord);
      let sampleZ = linearDepth(sampleDepth);

      if (viewDepth > (sampleZ + sampleBias)) {
        let intensity = smoothstep(0, 1, sampleRadius / abs(viewDepth - sampleZ));
        ao += intensity;
      }
    }

    ao = 1 - (ao / f32(ssao.sampleCount));
    return vec4f(0, 0, 0, ao);
  }
`;

// AO Blur
const BLUR_SHADER = /*wgsl*/`
  const pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(0) @binding(0) var ssaoTexture: texture_2d<f32>;
  @group(0) @binding(1) var ssaoSampler: sampler;

  // Values from https://www.rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
  const offsets : array<f32, 3> = array<f32, 3>(
    0.0, 1.3846153846, 3.2307692308);
  const weights : array<f32, 3> = array<f32, 3>(
    0.2270270270, 0.3162162162, 0.0702702703);

  const blurRadius = 1.0;

  override dirX = 0.0;
  override dirY = 1.0;

  fn getGaussianBlur(texcoord : vec2f) -> vec4f {
    let texelRadius = vec2f(blurRadius) / vec2f(textureDimensions(ssaoTexture));
    let step = vec2f(dirX, dirY) * texelRadius;

    var sum = vec4f(0);
    sum = sum + textureSample(ssaoTexture, ssaoSampler, texcoord) * weights[0];

    sum = sum + textureSample(ssaoTexture, ssaoSampler, texcoord + step * 1.0) * weights[1];
    sum = sum + textureSample(ssaoTexture, ssaoSampler, texcoord - step * 1.0) * weights[1];

    sum = sum + textureSample(ssaoTexture, ssaoSampler, texcoord + step * 2.0) * weights[2];
    sum = sum + textureSample(ssaoTexture, ssaoSampler, texcoord - step * 2.0) * weights[2];

    // This is more compact than the unrolled loop above, but was causing corruption on older Mac Intel GPUs.
    //for (var i = 1; i < 3; i = i + 1) {
    //  sum = sum + textureSample(bloomTexture, bloomSampler, texCoord + step * f32(i)) * weights[i];
    //  sum = sum + textureSample(bloomTexture, bloomSampler, texCoord - step * f32(i)) * weights[i];
    //}

    return sum;
  }

  @fragment
  fn blurMainAlpha(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = (1 / vec2f(textureDimensions(ssaoTexture)));
    let texcoord = pos.xy * texelSize;

    return getGaussianBlur(texcoord).aaaa;
  }

  @fragment
  fn blurMainRed(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = (1 / vec2f(textureDimensions(ssaoTexture)));
    let texcoord = pos.xy * texelSize;

    return getGaussianBlur(texcoord).rrrr;
  }
`;

export class SsaoRenderer {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  sampleBuffer: GPUBuffer;

  blurPipelineA: GPURenderPipeline;
  blurPipelineB: GPURenderPipeline;
  blurTexture: GPUTexture;
  blurTextureView: GPUTextureView;
  blurBindGroup: GPUBindGroup;

  constructor(public device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout, colorFormat: GPUTextureFormat) {
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'ssao bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'depth' } // Depth texture
      }, {
        binding: 1, // Normal texture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}, // Normal texture
      }, {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }, {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' }
      }]
    });

    const shaderModule = device.createShaderModule({
      label: 'ssao shader',
      code: SSAO_SHADER,
    });

    // Setup a render pipeline for drawing the skybox
    this.pipeline = device.createRenderPipeline({
      label: `ssao pipeline`,
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          frameBindGroupLayout,
          this.bindGroupLayout
        ]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: colorFormat,
          writeMask: GPUColorWrite.ALPHA,
          blend: {
            color: {},
            alpha: {
              operation: 'min',
              srcFactor: 'one',
              dstFactor: 'one',
            },
          },
        }],
      }
    });

    const blurShaderModule = device.createShaderModule({
      label: 'blur shader',
      code: BLUR_SHADER,
    });

    this.blurPipelineA = device.createRenderPipeline({
      label: `ssao blur pipeline A`,
      layout: 'auto',
      vertex: {
        module: blurShaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: blurShaderModule,
        entryPoint: 'blurMainAlpha',
        targets: [{
          format: BLUR_TARGET_FORMAT,
        }],
      }
    });

    this.blurPipelineB = device.createRenderPipeline({
      label: `ssao blur pipeline B`,
      layout: 'auto',
      vertex: {
        module: blurShaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: blurShaderModule,
        entryPoint: 'blurMainRed',
        constants: {
          dirX: 1,
          dirY: 0,
        },
        targets: [{
          format: colorFormat,
          writeMask: GPUColorWrite.ALPHA,
        }],
      }
    });

    this.sampler = device.createSampler({
      label: 'ssao sampler',
      minFilter: 'linear',
      magFilter: 'linear',
    });

    this.sampleBuffer = device.createBuffer({
      size: (4 * Float32Array.BYTES_PER_ELEMENT * (SSAO_SAMPLES + SSAO_NOISE_VALUES + 1)),
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    const sampleBufferArrayBuffer = this.sampleBuffer.getMappedRange();

    new Uint32Array(sampleBufferArrayBuffer, 0, 1)[0] = SSAO_SAMPLES;

    function lerp(a: number, b: number, t: number): number {
      return a + t * (b - a);
    }

    // Generate noise
    for (let i = 0; i < SSAO_NOISE_VALUES; ++i) {
      const v = new Vec3(sampleBufferArrayBuffer, (i + 1) * 16);
      v[0] = Math.random() * 2 - 1;
      v[1] = Math.random() * 2 - 1;
      v[2] = 0.0
      v.normalize();
    }

    // Generate a random hemisphere of samples
    for (let i = 0; i < SSAO_SAMPLES; ++i) {
      const v = new Vec3(sampleBufferArrayBuffer, (i + SSAO_NOISE_VALUES + 1) * 16);

      do {
        v[0] = Math.random() * 2 - 1;
        v[1] = Math.random() * 2 - 1;
        v[2] = Math.random();
        v.normalize();
      } while (v.dot(UNIT_VEC_Z) < 0.2) // Ensure the vectors aren't TOO flat, as that can cause artifacts.

      v.scale(Math.random());
      let scale = (i / SSAO_SAMPLES);
      scale = lerp(0.1, 1.0, scale * scale);
      v.scale(scale);
    }
    this.sampleBuffer.unmap();
  }

  render(encoder: GPUCommandEncoder, frameBindGroup: GPUBindGroup,
         depthTextureView: GPUTextureView,
         normalTextureView: GPUTextureView,
         targetTexture: GPUTexture) {
    // TODO: Don't recreate this every frame
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: depthTextureView,
      }, {
        binding: 1,
        resource: normalTextureView,
      }, {
        binding: 2,
        resource: this.sampler
      }, {
        binding: 3,
        resource: { buffer: this.sampleBuffer }
      }],
    });

    const targetTextureView = targetTexture.createView();

    const targetBindGroup = this.device.createBindGroup({
      layout: this.blurPipelineA.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: targetTextureView,
      }, {
        binding: 1,
        resource: this.sampler
      }],
    });

    if (!this.blurTexture ||
        this.blurTexture.width != targetTexture.width ||
        this.blurTexture.height != targetTexture.height) {
      this.blurTexture = this.device.createTexture({
        size: { width: targetTexture.width, height: targetTexture.height },
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: BLUR_TARGET_FORMAT,
      });
      this.blurTextureView = this.blurTexture.createView();

      this.blurBindGroup = this.device.createBindGroup({
        layout: this.blurPipelineB.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: this.blurTextureView,
        }, {
          binding: 1,
          resource: this.sampler
        }],
      });
    }

    const ssaoPass = encoder.beginRenderPass({
      label: 'ssao pass',
      colorAttachments: [{
        view: targetTextureView,
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    ssaoPass.setPipeline(this.pipeline);
    ssaoPass.setBindGroup(0, frameBindGroup);
    ssaoPass.setBindGroup(1, bindGroup);
    ssaoPass.draw(3);

    ssaoPass.end();

    // Blur pass A
    const blurPassA = encoder.beginRenderPass({
      label: 'blur pass A',
      colorAttachments: [{
        view: this.blurTextureView,
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    blurPassA.setPipeline(this.blurPipelineA);
    blurPassA.setBindGroup(0, targetBindGroup);
    blurPassA.draw(3);

    blurPassA.end();

    // Blur pass B
    const blurPassB = encoder.beginRenderPass({
      label: 'blur pass B',
      colorAttachments: [{
        view: targetTextureView,
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    blurPassB.setPipeline(this.blurPipelineB);
    blurPassB.setBindGroup(0, this.blurBindGroup);
    blurPassB.draw(3);

    blurPassB.end();
  }
}
