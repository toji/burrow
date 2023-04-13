export const toneMappingShader = /* wgsl */`
  const pos = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(0) @binding(0) var lightTexture: texture_2d<f32>;
  @group(0) @binding(1) var bloomTexture: texture_2d<f32>;
  @group(0) @binding(2) var bloomSampler: sampler;

  @group(0) @binding(3) var<uniform> exposureBloom: vec2f;

  const invGamma = 1 / 2.2;

  // All from http://filmicworlds.com/blog/filmic-tonemapping-operators/
  fn linearTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * exposureBloom.x;
    return pow(color, vec3f(invGamma));
  }

  fn reinhardTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * exposureBloom.x;
    let mappedColor = color / (1+color);
    return pow(mappedColor, vec3f(invGamma));
  }

  fn cineonOptimizedTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * exposureBloom.x;
    let x = max(vec3f(0), color-0.004);
    return (x*(6.2*x+.5))/(x*(6.2*x+1.7)+0.06); // No gamma adjustment necessary.
  }

  @fragment
  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let pixelCoord = vec2u(pos.xy);
    let linearColor = textureLoad(lightTexture, pixelCoord, 0).rgb;

    let tonemappedColor = cineonOptimizedTonemap(linearColor);

    return vec4f(tonemappedColor, 1);
  }

  @fragment
  fn fragmentBloomMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let pixelCoord = vec2u(pos.xy);
    let textureSize = vec2f(textureDimensions(lightTexture));
    let texCoord = pos.xy / textureSize;
    let linearColor = textureLoad(lightTexture, pixelCoord, 0).rgb;
    let bloomColor = textureSample(bloomTexture, bloomSampler, texCoord).rgb;
    let mixedColor = mix(linearColor, bloomColor, exposureBloom.y);

    let tonemappedColor = cineonOptimizedTonemap(mixedColor);

    return vec4f(tonemappedColor, 1);
  }
`;

export class TonemapRenderer {
  bindGroupLayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;
  bloomPipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  sampler: GPUSampler;

  inputTextureView: GPUTextureView;
  bloomTextureView: GPUTextureView;

  #uniformArray: Float32Array = new Float32Array(4);

  constructor(public device: GPUDevice, format: GPUTextureFormat) {
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'tone mapping bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' }
      }, {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { }
      }, {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }, {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {}
      }]
    });

    const module = this.device.createShaderModule({
      label: 'tone mapping shader module',
      code: toneMappingShader
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'tone mapping pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format,
        }],
      },
    });

    this.bloomPipeline = this.device.createRenderPipeline({
      label: 'tone mapping and bloom pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module,
        entryPoint: 'fragmentBloomMain',
        targets: [{
          format,
        }],
      },
    });

    this.uniformBuffer = device.createBuffer({
      label: 'tone mapping uniform buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.sampler = device.createSampler({
      label: 'tone mapping sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
    });

    this.#uniformArray[0] = 1.0; // Exposure
    this.#uniformArray[1] = 0.05; // bloomStrength
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.#uniformArray);
  }

  get exposure(): number {
    return this.#uniformArray[0];
  }

  set exposure(value: number) {
    this.#uniformArray[0] = value;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.#uniformArray);
  }

  get bloomStrength(): number {
    return this.#uniformArray[1];
  }

  set bloomStrength(value: number) {
    this.#uniformArray[1] = value;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.#uniformArray);
  }

  updateInputTexture(texture: GPUTexture) {
    this.inputTextureView = texture.createView();

    this.bindGroup = this.device.createBindGroup({
      label: 'tone mapping bind group',
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: this.inputTextureView,
      }, {
        binding: 1,
        resource: this.bloomTextureView ? this.bloomTextureView : this.inputTextureView,
      }, {
        binding: 2,
        resource: this.sampler,
      }, {
        binding: 3,
        resource: { buffer: this.uniformBuffer },
      }]
    });
  }

  updateBloomTexture(texture: GPUTexture) {
    if (texture) {
      this.bloomTextureView = texture.createView({
        baseMipLevel: 0,
        mipLevelCount: 1,
      })
    } else {
      this.bloomTextureView = null;
    }

    this.bindGroup = this.device.createBindGroup({
      label: 'tone mapping bind group',
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: this.inputTextureView,
      }, {
        binding: 1,
        resource: this.bloomTextureView ? this.bloomTextureView : this.inputTextureView,
      }, {
        binding: 2,
        resource: this.sampler,
      }, {
        binding: 3,
        resource: { buffer: this.uniformBuffer },
      }]
    });
  }

  render(renderPass: GPURenderPassEncoder, enableBloom: boolean = true) {
    if (!this.bindGroup) { return; }

    enableBloom = enableBloom && this.bloomStrength > 0 && this.bloomTextureView !== null;

    // Tonemap the input texture
    renderPass.setPipeline(enableBloom ? this.bloomPipeline : this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(3);
  }
}