import { cameraStruct } from "../shaders/common.js";
import { Vec3 } from '../../../node_modules/gl-matrix/dist/esm/index.js';
const SSAO_SAMPLES = 8;
const SSAO_SHADER = /*wgsl*/ `
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
    samples: array<vec3f>,
  }
  @group(1) @binding(3) var<storage> ssao: SsaoSamples;
  
  const sampleRadius = 0.2;
  const sampleBias = 0.005;

  fn viewPosFromDepth(texcoord: vec2f, depth: f32) -> vec3f {
    let clipSpacePos = vec4f((texcoord * 2 - 1), depth, 1);
    let viewPos = camera.invProjection * clipSpacePos;
    return (viewPos.xyz / viewPos.w);
  }

  fn linearDepth(depthSample : f32) -> f32 {
    return camera.zRange[1] * camera.zRange[0] / fma(depthSample, camera.zRange[0]-camera.zRange[1], camera.zRange[1]);
  }

  @fragment
  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = (1.0 / vec2f(textureDimensions(depthTexture)));
    let texcoord = pos.xy * texelSize;
    
    let normal = normalize(2 * textureSample(normalTexture, ssaoSampler, texcoord).xyz - 1);
    let depth = textureSample(depthTexture, ssaoSampler, texcoord);

    //let randomVec = normalize(vec3f(2 * noiseSample.xy - 1, noiseSample.z));
    let randomVec = normalize(vec3f(0.5));
    let tangent = normalize(randomVec - normal * dot(randomVec, normal));
    let bitangent = cross(normal, tangent);
    let tbn = mat3x3f(tangent, bitangent, normal);

    let viewPos = viewPosFromDepth(texcoord, depth);
    let viewDepth = linearDepth(depth);

    var ao = 0.0;
    for (var i = 0u; i < ssao.sampleCount; i++) {
      let samplePos = viewPos + (tbn * ssao.samples[i] * sampleRadius);
      var offset = vec4f(samplePos, 1);
      offset = camera.projection * offset;
      let offsetCoord = (offset.xy / offset.w) * 0.5 + 0.5;
      let sampleDepth = textureSample(depthTexture, ssaoSampler, offsetCoord);
      //ao += sampleDepth;
      
      let sampleZ = linearDepth(sampleDepth);
      let rangeCheck = smoothstep(0, 1, sampleRadius / abs(viewDepth - sampleZ));
      if (viewDepth > (sampleZ + sampleBias)) {
        ao += rangeCheck;
      }
    }

    ao = 1 - (ao / f32(ssao.sampleCount));
    return vec4f(0, 0, 0, ao);
  }
`;
export class SsaoRenderer {
    device;
    pipeline;
    bindGroupLayout;
    sampler;
    sampleBuffer;
    constructor(device, frameBindGroupLayout, colorFormat) {
        this.device = device;
        this.bindGroupLayout = device.createBindGroupLayout({
            label: 'ssao bind group layout',
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'depth' } // Depth texture
                }, {
                    binding: 1,
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
        const fragmentTargets = [{
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
            }];
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
                targets: fragmentTargets,
            }
        });
        this.sampler = device.createSampler({
            label: 'ssao sampler',
            minFilter: 'linear',
            magFilter: 'linear',
        });
        this.sampleBuffer = device.createBuffer({
            size: (4 * Float32Array.BYTES_PER_ELEMENT * (SSAO_SAMPLES + 1)),
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });
        const sampleBufferArrayBuffer = this.sampleBuffer.getMappedRange();
        new Uint32Array(sampleBufferArrayBuffer, 0, 1)[0] = SSAO_SAMPLES;
        // Generate a random hemisphere of samples
        for (let i = 0; i < SSAO_SAMPLES; ++i) {
            const v = new Vec3(sampleBufferArrayBuffer, i * 16 + 4);
            do {
                v[0] = Math.random() * 2 - 1;
                v[1] = Math.random() * 2 - 1;
                v[2] = Math.random();
            } while (Vec3.magnitude(v) <= 1);
        }
        this.sampleBuffer.unmap();
    }
    render(renderPass, depthTextureView, normalTextureView) {
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
        // Skybox is part of the frame bind group, which should already be bound prior to calling this method.
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(1, bindGroup);
        renderPass.draw(3);
    }
}
//# sourceMappingURL=ssao.js.map