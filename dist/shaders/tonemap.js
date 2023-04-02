export const toneMappingShader = /* wgsl */ `
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
//# sourceMappingURL=tonemap.js.map