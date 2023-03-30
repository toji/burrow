import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js'

import { GeometryLayout } from '../geometry/geometry-layout.js';
import { AttributeLocation } from '../geometry/geometry.js';
import { RenderMaterial } from '../material/material.js';

export const cameraStruct = /* wgsl */`
  struct Camera {
    projection: mat4x4f,
    view: mat4x4f,
    invViewProjection: mat4x4f,
    position: vec3f,
    time: f32,
  };
`;

export const lightStruct = /* wgsl */`
  struct PointLight {
    position: vec3f,
    range: f32,
    color: vec3f,
    intensity: f32,
  };

  struct Lights {
    pointLightCount: u32,
    pointLights: array<PointLight>,
  };
`;

export function pbrMaterialInputs(group: number) {
  return /* wgsl */`
    struct PbrMaterialUniforms {
      baseColorFactor: vec4f,
      emissiveFactor: vec3f,
      metallicRoughnessFactor : vec2f,
      occlusionStrength : f32,
      alphaCutoff: f32,
    };
    @group(${group}) @binding(0) var<uniform> material : PbrMaterialUniforms;

    @group(${group}) @binding(1) var pbrSampler : sampler;
    @group(${group}) @binding(2) var baseColorTexture : texture_2d<f32>;
    @group(${group}) @binding(3) var normalTexture : texture_2d<f32>;
    @group(${group}) @binding(4) var metallicRoughnessTexture : texture_2d<f32>;
    @group(${group}) @binding(5) var emissiveTexture : texture_2d<f32>;
    @group(${group}) @binding(6) var occlusionTexture : texture_2d<f32>;
  `;
}


export function getGBufferShader(layout: Readonly<GeometryLayout>, material: RenderMaterial): string {
  const locationsUsed = layout.locationsUsed;

  return wgsl`
    ${cameraStruct}
    @group(0) @binding(0) var<uniform> camera : Camera;

    struct VertexInput {
      @location(${AttributeLocation.position}) position : vec4f,
#if ${locationsUsed.has(AttributeLocation.color)}
      @location(${AttributeLocation.color}) color : vec3f,
#endif
#if ${locationsUsed.has(AttributeLocation.normal)}
      @location(${AttributeLocation.normal}) normal : vec3f,
#endif
#if ${locationsUsed.has(AttributeLocation.tangent)}
      @location(${AttributeLocation.tangent}) tangent : vec4f,
#endif
#if ${locationsUsed.has(AttributeLocation.texcoord)}
      @location(${AttributeLocation.texcoord}) texcoord : vec2f,
#endif
    };

    struct VertexOutput {
      @builtin(position) position : vec4f,
      @location(1) color : vec3f,
      @location(2) normal : vec3f,
      @location(3) tangent : vec3f,
      @location(4) bitangent : vec3f,
      @location(5) texcoord : vec2f,
    };

    const IDENTITY_4x4 = mat4x4(1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1);

    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {
      var output : VertexOutput;

      let model = IDENTITY_4x4;

      output.position = camera.projection * camera.view * model * input.position;

#if ${locationsUsed.has(AttributeLocation.color)}
      output.color = input.color;
#else
      output.color = vec3(1, 1, 1);
#endif

#if ${locationsUsed.has(AttributeLocation.normal)}
      output.normal = input.normal; // World space normal
#endif

#if ${locationsUsed.has(AttributeLocation.tangent)}
      output.tangent = normalize((model * vec4(input.tangent.xyz, 0.0)).xyz);
      output.bitangent = cross(output.normal, output.tangent) * input.tangent.w;
#endif

#if ${locationsUsed.has(AttributeLocation.texcoord)}
      output.texcoord = input.texcoord;
#endif

      return output;
    }

    ${pbrMaterialInputs(/*@group*/ 1)}

    struct FragmentOutput {
      @location(0) albedo : vec4f,
      @location(1) normal : vec4f,
      @location(2) metalRough : vec2f,
      @location(3) light : vec4f,
    };

    const lightAmbient = vec3f(0.01);

    @fragment
    fn fragmentMain(input : VertexOutput) -> FragmentOutput {
      var out: FragmentOutput;

      let baseColor = material.baseColorFactor * textureSample(baseColorTexture, pbrSampler, input.texcoord);
      let occlusion = material.occlusionStrength * textureSample(occlusionTexture, pbrSampler, input.texcoord).r;

      out.albedo = vec4f(input.color, occlusion) * baseColor;
      out.metalRough = material.metallicRoughnessFactor * textureSample(metallicRoughnessTexture, pbrSampler, input.texcoord).rg;

#if ${locationsUsed.has(AttributeLocation.tangent)}
      let tbn = mat3x3f(input.tangent, input.bitangent, input.normal);
      let N = textureSample(normalTexture, pbrSampler, input.texcoord).rgb;
      let normal = tbn * (2 * N - 1);
#else
      let normal = input.normal;
#endif

      out.normal = vec4(normalize(normal) * 0.5 + 0.5, 1);

      // Add emissive here too eventually
      let emissive = material.emissiveFactor * textureSample(emissiveTexture, pbrSampler, input.texcoord).rgb;
      out.light = vec4f((input.color * lightAmbient) + emissive, 1);

#if ${material.discard}
      if (baseColor.a < material.alphaCutoff) {
        discard;
      }
#endif

      return out;
    }
  `;
}

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
    let targetSize = vec2f(textureDimensions(colorTexture, 0));
    let pixelCoord = vec2u(pos.xy);

    let color = textureLoad(colorTexture, pixelCoord, 0);
    let normal = textureLoad(normalTexture, pixelCoord, 0);
    let metalRough = textureLoad(metalRoughTexture, pixelCoord, 0);
    let depth = textureLoad(depthTexture, pixelCoord, 0);
    let worldPos = worldPosFromDepth((pos.xy / targetSize), depth);

    let occlusion = color.a;

    var Lo = vec3f(0);

    // Simple directional light
    {
      let N = normalize(2 * normal.xyz - 1);
      let L = normalize(lightDir);
      let NDotL = max(dot(N, L), 0.0);
      Lo += color.rgb * NDotL * dirColor * occlusion;
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

      Lo += color.rgb * NDotL * lightColor * lightIntensity * atten * occlusion;
    }

    return vec4f(Lo, 1);
  }
`;
