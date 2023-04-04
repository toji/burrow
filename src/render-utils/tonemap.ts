export const toneMappingShader = /* wgsl */`
  const pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(0) @binding(0) var lightTexture: texture_2d<f32>;
  @group(0) @binding(1) var<uniform> tonemapExposure: f32;

  const invGamma = 1 / 2.2;

  // All from http://filmicworlds.com/blog/filmic-tonemapping-operators/
  fn linearTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * tonemapExposure;
    return pow(color, vec3f(invGamma));
  }

  fn reinhardTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * tonemapExposure;
    let mappedColor = color / (1+color);
    return pow(mappedColor, vec3f(invGamma));
  }

  fn cineonOptimizedTonemap(linearColor: vec3f) -> vec3f {
    let color = linearColor * tonemapExposure;
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
`;

export class TonemapRenderer {
  bindGroupLayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;

  #exposure: Float32Array = new Float32Array(4);

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
          format: navigator.gpu.getPreferredCanvasFormat(),
        }],
      },
    });

    this.uniformBuffer = device.createBuffer({
      label: 'tone mapping uniform buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.exposure = 1.0;
  }

  get exposure(): number {
    return this.#exposure[0];
  }

  set exposure(value: number) {
    this.#exposure[0] = value;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.#exposure);
  }

  updateInputTexture(textureView: GPUTextureView) {
    this.bindGroup = this.device.createBindGroup({
      label: 'tone mapping bind group',
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: textureView,
      }, {
        binding: 1,
        resource: { buffer: this.uniformBuffer },
      }]
    });
  }

  render(renderPass: GPURenderPassEncoder) {
    if (!this.bindGroup) { return; }

    // Tonemap the input texture
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(3);
  }
}