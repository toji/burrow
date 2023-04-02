// This is from https://github.com/toji/web-texture-tool, copied here for convenience.
// TODO: Does this need to handle sRGB formats differently?
const mipmapShader = /* wgsl */ `
  var<private> pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texCoord : vec2f,
  };

  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);
    output.position = vec4(pos[vertexIndex], 0.0, 1.0);
    return output;
  }

  @group(0) @binding(0) var imgSampler : sampler;
  @group(0) @binding(1) var img : texture_2d<f32>;

  @fragment
  fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
    return textureSample(img, imgSampler, texCoord);
  }
`;
export class WebGPUMipmapGenerator {
    device;
    sampler;
    mipmapShaderModule;
    bindGroupLayout;
    pipelineLayout;
    // We'll need a new pipeline for every texture format used.
    pipelines = new Map();
    constructor(device) {
        this.device = device;
    }
    getMipmapPipeline(format) {
        let pipeline = this.pipelines.get(format);
        if (!pipeline) {
            // Some resources are shared between all pipelines, so only create once.
            if (!this.mipmapShaderModule) {
                this.mipmapShaderModule = this.device.createShaderModule({
                    label: 'Mipmap Generator Shader',
                    code: mipmapShader,
                });
                this.bindGroupLayout = this.device.createBindGroupLayout({
                    label: 'Mipmap Generator Bind Group Layout',
                    entries: [{
                            binding: 0,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {}
                        }, {
                            binding: 1,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: {}
                        }]
                });
                this.pipelineLayout = this.device.createPipelineLayout({
                    label: 'Mipmap Generator Pipeline Layout',
                    bindGroupLayouts: [this.bindGroupLayout]
                });
                this.sampler = this.device.createSampler({
                    label: 'Mipmap Generator Sampler',
                    minFilter: 'linear'
                });
            }
            pipeline = this.device.createRenderPipeline({
                label: `Mipmap Generator ${format} Render Pipeline`,
                layout: this.pipelineLayout,
                vertex: {
                    module: this.mipmapShaderModule,
                    entryPoint: 'vertexMain',
                },
                fragment: {
                    module: this.mipmapShaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{ format }],
                }
            });
            this.pipelines.set(format, pipeline);
        }
        return pipeline;
    }
    /**
     * Generates mipmaps for the given GPUTexture from the data in level 0.
     *
     * @param texture - Texture to generate mipmaps for.
     */
    generateMipmap(texture) {
        const pipeline = this.getMipmapPipeline(texture.format);
        if (texture.dimension == '3d' || texture.dimension == '1d') {
            throw new Error('Generating mipmaps for non-2d textures is currently unsupported!');
        }
        let mipTexture = texture;
        const arrayLayerCount = texture.depthOrArrayLayers; // Only valid for 2D textures.
        // If the texture was created with RENDER_ATTACHMENT usage we can render directly between mip levels.
        const renderToSource = texture.usage & GPUTextureUsage.RENDER_ATTACHMENT;
        if (!renderToSource) {
            // Otherwise we have to use a separate texture to render into. It can be one mip level smaller than the source
            // texture, since we already have the top level.
            const mipTextureDescriptor = {
                size: {
                    width: Math.ceil(texture.width / 2),
                    height: Math.ceil(texture.height / 2),
                    depthOrArrayLayers: arrayLayerCount,
                },
                format: texture.format,
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
                mipLevelCount: texture.mipLevelCount - 1,
            };
            mipTexture = this.device.createTexture(mipTextureDescriptor);
        }
        const commandEncoder = this.device.createCommandEncoder({});
        for (let arrayLayer = 0; arrayLayer < arrayLayerCount; ++arrayLayer) {
            let srcView = texture.createView({
                baseMipLevel: 0,
                mipLevelCount: 1,
                dimension: '2d',
                baseArrayLayer: arrayLayer,
                arrayLayerCount: 1,
            });
            let dstMipLevel = renderToSource ? 1 : 0;
            for (let i = 1; i < texture.mipLevelCount; ++i) {
                const dstView = mipTexture.createView({
                    baseMipLevel: dstMipLevel++,
                    mipLevelCount: 1,
                    dimension: '2d',
                    baseArrayLayer: arrayLayer,
                    arrayLayerCount: 1,
                });
                const passEncoder = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                            view: dstView,
                            loadOp: 'clear',
                            storeOp: 'store'
                        }],
                });
                const bindGroup = this.device.createBindGroup({
                    layout: this.bindGroupLayout,
                    entries: [{
                            binding: 0,
                            resource: this.sampler,
                        }, {
                            binding: 1,
                            resource: srcView,
                        }],
                });
                passEncoder.setPipeline(pipeline);
                passEncoder.setBindGroup(0, bindGroup);
                passEncoder.draw(3, 1, 0, 0);
                passEncoder.end();
                srcView = dstView;
            }
        }
        // If we didn't render to the source texture, finish by copying the mip results from the temporary mipmap texture
        // to the source.
        if (!renderToSource) {
            const mipLevelSize = {
                width: Math.ceil(texture.width / 2),
                height: Math.ceil(texture.height / 2),
                depthOrArrayLayers: arrayLayerCount,
            };
            for (let i = 1; i < texture.mipLevelCount; ++i) {
                commandEncoder.copyTextureToTexture({
                    texture: mipTexture,
                    mipLevel: i - 1,
                }, {
                    texture: texture,
                    mipLevel: i,
                }, mipLevelSize);
                mipLevelSize.width = Math.ceil(mipLevelSize.width / 2);
                mipLevelSize.height = Math.ceil(mipLevelSize.height / 2);
            }
        }
        this.device.queue.submit([commandEncoder.finish()]);
        if (!renderToSource) {
            mipTexture.destroy();
        }
        return texture;
    }
}
//# sourceMappingURL=mipmap-generator.js.map