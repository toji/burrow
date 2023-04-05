// Technique from https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom
const BLOOM_STEPS = 5;
// TODO: Maybe this can be done more efficiently in a compute shader?
export const bloomShader = /* wgsl */ `
  const pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(0) @binding(0) var sourceTexture: texture_2d<f32>;
  @group(0) @binding(1) var sourceSampler: sampler;

  @fragment
  fn downsampleMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = 1.0 / vec2f(textureDimensions(sourceTexture));
    let texcoord = pos.xy * texelSize * 2;
    let x = texelSize.x;
    let y = texelSize.y;

    let a = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - 2*x, texcoord.y + 2*y)).rgb;
    let b = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,       texcoord.y + 2*y)).rgb;
    let c = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + 2*x, texcoord.y + 2*y)).rgb;

    let d = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - 2*x, texcoord.y)).rgb;
    let e = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,       texcoord.y)).rgb;
    let f = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + 2*x, texcoord.y)).rgb;

    let g = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - 2*x, texcoord.y - 2*y)).rgb;
    let h = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,       texcoord.y - 2*y)).rgb;
    let i = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + 2*x, texcoord.y - 2*y)).rgb;

    let j = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - x, texcoord.y + y)).rgb;
    let k = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + x, texcoord.y + y)).rgb;
    let l = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - x, texcoord.y - y)).rgb;
    let m = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + x, texcoord.y - y)).rgb;

    var downsample = e*0.125;
    downsample += (a+c+g+i)*0.03125;
    downsample += (b+d+f+h)*0.0625;
    downsample += (j+k+l+m)*0.125;
    return vec4f(downsample, 1);
  }

  const filterRadius = 0.005;

  @fragment
  fn upsampleMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let texelSize = 1.0 / vec2f(textureDimensions(sourceTexture));
    let texcoord = pos.xy * texelSize / 2;
    let x = filterRadius;
    let y = filterRadius;

    let a = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - x, texcoord.y + y)).rgb;
    let b = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,     texcoord.y + y)).rgb;
    let c = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + x, texcoord.y + y)).rgb;

    let d = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - x, texcoord.y)).rgb;
    let e = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,     texcoord.y)).rgb;
    let f = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + x, texcoord.y)).rgb;

    let g = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x - x, texcoord.y - y)).rgb;
    let h = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x,     texcoord.y - y)).rgb;
    let i = textureSample(sourceTexture, sourceSampler, vec2f(texcoord.x + x, texcoord.y - y)).rgb;

    var upsample = e*4.0;
    upsample += (b+d+f+h)*2.0;
    upsample += (a+c+g+i);
    upsample *= 1.0 / 16.0;
    return vec4f(upsample, 1);
  }
`;
export class BloomRenderer {
    device;
    bindGroupLayout;
    bindGroups;
    downsamplePipeline;
    upsamplePipeline;
    sampler;
    inputTextureView;
    intermediateTexture;
    constructor(device, format) {
        this.device = device;
        this.bindGroupLayout = device.createBindGroupLayout({
            label: 'bloom bind group layout',
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                }]
        });
        const module = device.createShaderModule({
            label: 'bloom shader module',
            code: bloomShader
        });
        const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
        this.downsamplePipeline = device.createRenderPipeline({
            label: 'bloom downsample pipeline',
            layout: pipelineLayout,
            vertex: {
                module,
                entryPoint: 'vertexMain',
            },
            fragment: {
                module,
                entryPoint: 'downsampleMain',
                targets: [{
                        format,
                    }],
            },
        });
        this.upsamplePipeline = this.device.createRenderPipeline({
            label: 'bloom upsample pipeline',
            layout: pipelineLayout,
            vertex: {
                module,
                entryPoint: 'vertexMain',
            },
            fragment: {
                module,
                entryPoint: 'upsampleMain',
                targets: [{
                        format,
                        blend: {
                            color: {
                                srcFactor: 'one',
                                dstFactor: 'one',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'zero',
                            }
                        }
                    }],
            },
        });
        this.sampler = device.createSampler({
            label: 'bloom sampler',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
        });
    }
    updateInputTexture(texture) {
        this.inputTextureView = texture.createView();
        this.bindGroups = [this.device.createBindGroup({
                label: 'bloom bind group lvl 0',
                layout: this.bindGroupLayout,
                entries: [{
                        binding: 0,
                        resource: this.inputTextureView,
                    }, {
                        binding: 1,
                        resource: this.sampler,
                    }]
            })];
        this.intermediateTexture = this.device.createTexture({
            label: 'bloom intermediate texture',
            size: { width: texture.width / 2, height: texture.height / 2 },
            mipLevelCount: BLOOM_STEPS,
            format: texture.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        for (let i = 0; i < BLOOM_STEPS; ++i) {
            this.bindGroups.push(this.device.createBindGroup({
                label: `bloom bind group lvl ${i + 1}`,
                layout: this.bindGroupLayout,
                entries: [{
                        binding: 0,
                        resource: this.intermediateTexture.createView({
                            baseMipLevel: i,
                            mipLevelCount: 1
                        }),
                    }, {
                        binding: 1,
                        resource: this.sampler,
                    }]
            }));
        }
    }
    // Produces a bloom texture but does not mix it with the lighting buffer.
    // That happens during tone mapping.
    render(encoder) {
        if (!this.inputTextureView) {
            return;
        }
        // Downsample steps
        for (let i = 0; i < BLOOM_STEPS; ++i) {
            let renderPass = encoder.beginRenderPass({
                colorAttachments: [{
                        view: this.intermediateTexture.createView({
                            baseMipLevel: i,
                            mipLevelCount: 1,
                        }),
                        loadOp: 'clear',
                        storeOp: 'store',
                    }]
            });
            renderPass.setPipeline(this.downsamplePipeline);
            renderPass.setBindGroup(0, this.bindGroups[i]);
            renderPass.draw(3);
            renderPass.end();
        }
        // Upsample steps
        for (let i = BLOOM_STEPS - 1; i > 0; --i) {
            let renderPass = encoder.beginRenderPass({
                colorAttachments: [{
                        view: this.intermediateTexture.createView({
                            baseMipLevel: i - 1,
                            mipLevelCount: 1,
                        }),
                        loadOp: 'load',
                        storeOp: 'store',
                    }]
            });
            renderPass.setPipeline(this.upsamplePipeline);
            renderPass.setBindGroup(0, this.bindGroups[i + 1]);
            renderPass.draw(3);
            renderPass.end();
        }
    }
}
//# sourceMappingURL=bloom.js.map