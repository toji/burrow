/// <reference types="dist" />
export declare const toneMappingShader = "\n  const pos : array<vec2f, 3> = array<vec2f, 3>(\n    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));\n\n  @vertex\n  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {\n    return vec4f(pos[i], 0, 1);\n  }\n\n  @group(0) @binding(0) var lightTexture: texture_2d<f32>;\n  @group(0) @binding(1) var<uniform> tonemapExposure: f32;\n\n  const invGamma = 1 / 2.2;\n\n  // All from http://filmicworlds.com/blog/filmic-tonemapping-operators/\n  fn linearTonemap(linearColor: vec3f) -> vec3f {\n    let color = linearColor * tonemapExposure;\n    return pow(color, vec3f(invGamma));\n  }\n\n  fn reinhardTonemap(linearColor: vec3f) -> vec3f {\n    let color = linearColor * tonemapExposure;\n    let mappedColor = color / (1+color);\n    return pow(mappedColor, vec3f(invGamma));\n  }\n\n  fn cineonOptimizedTonemap(linearColor: vec3f) -> vec3f {\n    let color = linearColor * tonemapExposure;\n    let x = max(vec3f(0), color-0.004);\n    return (x*(6.2*x+.5))/(x*(6.2*x+1.7)+0.06); // No gamma adjustment necessary.\n  }\n\n  @fragment\n  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {\n    let pixelCoord = vec2u(pos.xy);\n    let linearColor = textureLoad(lightTexture, pixelCoord, 0).rgb;\n\n    let tonemappedColor = cineonOptimizedTonemap(linearColor);\n\n    return vec4f(tonemappedColor, 1);\n  }\n";
export declare class TonemapRenderer {
    #private;
    device: GPUDevice;
    bindGroupLayout: GPUBindGroupLayout;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    get exposure(): number;
    set exposure(value: number);
    updateInputTexture(texture: GPUTexture): void;
    render(renderPass: GPURenderPassEncoder): void;
}
