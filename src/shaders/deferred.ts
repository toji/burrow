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

    @group(1) @binding(0) var<storage> instanceMat : array<mat4x4f>;

    struct VertexInput {
      @builtin(instance_index) instance: u32,
      @location(${AttributeLocation.position}) position: vec4f,
#if ${locationsUsed.has(AttributeLocation.color)}
      @location(${AttributeLocation.color}) color: vec3f,
#endif
#if ${locationsUsed.has(AttributeLocation.normal)}
      @location(${AttributeLocation.normal}) normal: vec3f,
#endif
#if ${locationsUsed.has(AttributeLocation.tangent)}
      @location(${AttributeLocation.tangent}) tangent: vec4f,
#endif
#if ${locationsUsed.has(AttributeLocation.texcoord)}
      @location(${AttributeLocation.texcoord}) texcoord: vec2f,
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

    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {
      var output : VertexOutput;

      let model = instanceMat[input.instance];

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

    ${pbrMaterialInputs(/*@group*/ 2)}

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

// Much of the shader used here was pulled from https://learnopengl.com/PBR/Lighting
// Thanks!
const PbrFunctions = wgsl`
const PI = ${Math.PI};

struct SurfaceInfo {
  worldPos: vec3f,
  albedo: vec3f,
  normal: vec3f,
  metalRough: vec2f,
  f0: vec3f,
  ao: f32,
  v: vec3f,
}

fn FresnelSchlick(cosTheta : f32, F0 : vec3f) -> vec3f {
  return F0 + (vec3f(1) - F0) * pow(1.0 - cosTheta, 5.0);
}

fn DistributionGGX(N : vec3f, H : vec3f, roughness : f32) -> f32 {
  let a      = roughness*roughness;
  let a2     = a*a;
  let NdotH  = max(dot(N, H), 0);
  let NdotH2 = NdotH*NdotH;

  let num    = a2;
  let denom  = (NdotH2 * (a2 - 1) + 1);

  return num / (PI * denom * denom);
}

fn GeometrySchlickGGX(NdotV : f32, roughness : f32) -> f32 {
  let r = roughness + 1;
  let k = (r*r) / 8;

  let num   = NdotV;
  let denom = NdotV * (1 - k) + k;

  return num / denom;
}

fn GeometrySmith(N : vec3f, V : vec3f, L : vec3f, roughness : f32) -> f32 {
  let NdotV = max(dot(N, V), 0);
  let NdotL = max(dot(N, L), 0);
  let ggx2  = GeometrySchlickGGX(NdotV, roughness);
  let ggx1  = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

fn lightRadiance(light : PointLight, surface: SurfaceInfo) -> vec3<f32> {
  let worldToLight = light.position - surface.worldPos;

  let L = normalize(worldToLight);
  let H = normalize(surface.v + L);

  // cook-torrance brdf
  let NDF = DistributionGGX(surface.normal, H, surface.metalRough.g);
  let G = GeometrySmith(surface.normal, surface.v, L, surface.metalRough.g);
  let F = FresnelSchlick(max(dot(H, surface.v), 0), surface.f0);

  let kD = (vec3f(1) - F) * (1 - surface.metalRough.r);
  let NdotL = max(dot(surface.normal, L), 0.0);

  let numerator = NDF * G * F;
  let denominator = max(4 * max(dot(surface.normal, surface.v), 0) * NdotL, 0.001);
  let specular = numerator / vec3(denominator);

  // Point light attenuation
  let dist = length(worldToLight);
  let atten = clamp(1 - pow(dist / light.range, 4), 0, 1) / pow(dist, 2);

  // add to outgoing radiance Lo
  let radiance = light.color * light.intensity * atten;
  return (kD * surface.albedo / vec3(PI) + specular) * radiance * NdotL;
}`;

export const lightingShader = /* wgsl */`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

  ${lightStruct}
  @group(0) @binding(1) var<storage> lights : Lights;

  ${PbrFunctions}

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

  @fragment
  fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
    let targetSize = vec2f(textureDimensions(colorTexture, 0));
    let pixelCoord = vec2u(pos.xy);

    let depth = textureLoad(depthTexture, pixelCoord, 0);

    var surface: SurfaceInfo;
    surface.worldPos = worldPosFromDepth((pos.xy / targetSize), depth);
    surface.v = normalize(camera.position - surface.worldPos);

    let color = textureLoad(colorTexture, pixelCoord, 0);
    surface.albedo = color.rgb;
    surface.ao = color.a;

    let normal = textureLoad(normalTexture, pixelCoord, 0);
    surface.normal = normalize(2 * normal.xyz - 1);

    surface.metalRough = textureLoad(metalRoughTexture, pixelCoord, 0).rg;

    let dielectricSpec = vec3f(0.04);
    surface.f0 = mix(dielectricSpec, surface.albedo, vec3f(surface.metalRough.r));

    // Emmissive is handled directly in the gBuffer pass

    var Lo = vec3f(0);

    // Point lights
    for (var i: u32 = 0; i < lights.pointLightCount; i++) {
      let light = &lights.pointLights[i];

      // calculate per-light radiance and add to outgoing radiance Lo
      Lo += lightRadiance(*light, surface);
    }

    return vec4f(Lo, 1);
  }
`;

export const diffuseLightingShader = /* wgsl */`
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

    let depth = textureLoad(depthTexture, pixelCoord, 0);

    var surface: SurfaceInfo;
    surface.worldPos = worldPosFromDepth((pos.xy / targetSize), depth);
    surface.v = normalize(camera.position - surface.worldPos);

    let color = textureLoad(colorTexture, pixelCoord, 0);
    surface.albedo = color.rgb;
    surface.ao = color.a;

    let normal = textureLoad(normalTexture, pixelCoord, 0);
    surface.normal = normalize(2 * normal.xyz - 1);

    surface.metalRough = textureLoad(metalRoughTexture, pixelCoord, 0).rg;

    let dielectricSpec = vec3f(0.04);
    surface.f0 = mix(dielectricSpec, surface.albedo, vec3f(surface.metalRough.r));

    // Emmissive is handled directly in the gBuffer pass

    var Lo = vec3f(0);

    // Simple directional light
    {
      let N = normalize(2 * normal.xyz - 1);
      let L = normalize(lightDir);
      let NDotL = max(dot(N, L), 0.0);
      Lo += color.rgb * NDotL * dirColor * surface.ao;
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
