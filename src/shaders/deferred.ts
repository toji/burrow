//import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js'

export const cameraStruct = /* wgsl */`
  struct Camera {
    projection : mat4x4f,
    view : mat4x4f,
    invViewProjection: mat4x4f,
    position : vec3f,
    time : f32,
  };
`;

export const lightStruct = /* wgsl */`
  struct PointLight {
    position : vec3<f32>,
    range : f32,
    color : vec3<f32>,
    intensity: f32,
  };

  struct Lights {
    pointLightCount: u32,
    pointLights: array<PointLight>,
  };
`;

export const gBufferShader = /* wgsl */`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

  struct VertexInput {
    @location(0) position : vec4f,
    @location(1) color : vec3f,
    @location(2) normal : vec3f,
    @location(3) texcoord : vec2f,
  };

  struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(1) color : vec3f,
    @location(2) normal : vec3f,
    @location(3) texcoord : vec2f,
  };

  @vertex
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    output.position = camera.projection * camera.view * input.position;
    output.color = input.color;
    output.normal = input.normal; // World space normal
    output.texcoord = input.texcoord;

    return output;
  }

  struct FragmentOutput {
    @location(0) albedo : vec4f,
    @location(1) normal : vec4f,
    @location(2) metalRough : vec2f,
    @location(3) light : vec4f,
  };

  const lightAmbient = vec3f(0.1);

  @fragment
  fn fragmentMain(input : VertexOutput) -> FragmentOutput {
    var out: FragmentOutput;

    out.albedo = vec4f(input.color + 0.1, 1);
    out.normal = vec4f(normalize(input.normal) * 0.5 + 0.5, 1);
    out.metalRough = input.texcoord;

    // Add emissive here too eventually
    out.light = vec4f(input.color * lightAmbient, 1);

    return out;
  }
`;

export const lightingShader = /* wgsl */`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

  ${lightStruct}
  @group(0) @binding(1) var<storage> lights : Lights;

  const pos : array<vec2f, 3> = array<vec2f, 3>(
    vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

  @vertex
  fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(pos[i], 0, 1);
  }

  @group(1) @binding(0) var colorTexture: texture_2d<f32>;
  @group(1) @binding(1) var normalTexture: texture_2d<f32>;
  @group(1) @binding(2) var metalRoughTexture: texture_2d<f32>;
  @group(1) @binding(3) var depthTexture: texture_depth_2d;

  fn worldPosFromDepth(texcoord: vec2f, depth: f32) -> vec3f {
    let clipSpacePos = vec4f((texcoord * 2 - 1) * vec2f(1, -1), depth, 1);
    let worldPos = camera.invViewProjection * clipSpacePos;
    return (worldPos.xyz / worldPos.w);
  }

  const lightDir = vec3f(0.25, 0.5, 1.0);
  const dirColor = vec3f(0.1);

  @fragment
  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    // TODO: Generate world position from coord

    let targetSize = vec2f(textureDimensions(colorTexture, 0));
    let pixelCoord = vec2u(pos.xy);

    let color = textureLoad(colorTexture, pixelCoord, 0);
    let normal = textureLoad(normalTexture, pixelCoord, 0);
    let metalRough = textureLoad(metalRoughTexture, pixelCoord, 0);
    let depth = textureLoad(depthTexture, pixelCoord, 0);
    let worldPos = worldPosFromDepth((pos.xy / targetSize), depth);

    var Lo = vec3f(0);

    // Simple directional light
    {
      let N = normalize(2 * normal.xyz - 1);
      let L = normalize(lightDir);
      let NDotL = max(dot(N, L), 0.0);
      Lo += color.rgb * NDotL * dirColor;
    }

    // Point lights
    for (var i: u32 = 0; i < lights.pointLightCount; i++) {
      let light = &lights.pointLights[i];
      let range = (*light).range;
      let lightColor = (*light).color;
      let lightIntensity = (*light).intensity;

      let worldToLight = (*light).position - worldPos;

      let N = normalize(2 * normal.xyz - 1);
      let L = normalize(worldToLight);
      let NDotL = max(dot(N, L), 0.0);

      let dist = length(worldToLight);
      let atten = clamp(1.0 - pow(dist / range, 4.0), 0.0, 1.0) / pow(dist, 2.0);

      Lo += color.rgb * NDotL * lightColor * lightIntensity * atten;
    }

    return vec4f(Lo, 1);
  }
`;
