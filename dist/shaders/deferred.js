// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';
import { AttributeLocation } from '../geometry/geometry.js';
import { cameraStruct, lightStruct } from './common.js';
import { PbrFunctions, surfaceInfoStruct } from './pbr.js';
export function pbrMaterialInputs(group) {
    return /* wgsl */ `
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
export function getGBufferShader(layout, material) {
    const locationsUsed = layout.locationsUsed;
    return wgsl `
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
      output.normal = normalize((model * vec4(input.normal, 0)).xyz); // World space normal
#endif

#if ${locationsUsed.has(AttributeLocation.tangent)}
      output.tangent = normalize((model * vec4(input.tangent.xyz, 0)).xyz);
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
      out.metalRough = material.metallicRoughnessFactor * textureSample(metallicRoughnessTexture, pbrSampler, input.texcoord).bg;

#if ${locationsUsed.has(AttributeLocation.tangent)}
      let tbn = mat3x3f(input.tangent, input.bitangent, input.normal);
      let N = textureSample(normalTexture, pbrSampler, input.texcoord).rgb;
      let normal = tbn * (2 * N - 1);
#else
      let normal = input.normal;
#endif

#if ${material.discard}
      if (baseColor.a < material.alphaCutoff) {
        discard;
      }
#endif

      out.normal = vec4(normalize(normal) * 0.5 + 0.5, 1);

      // Emissive gets output directly to the light accumulation texture
      let emissive = material.emissiveFactor * textureSample(emissiveTexture, pbrSampler, input.texcoord).rgb;
      out.light = vec4f((input.color * lightAmbient) + emissive, 1);

      return out;
    }
  `;
}
export function getLightingShader(useEnvLight, usePointLights, useDirLight) {
    return wgsl `
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

    @group(0) @binding(2) var environmentSampler : sampler;
    @group(0) @binding(3) var environmentTexture : texture_cube<f32>;

    @group(1) @binding(0) var colorTexture: texture_2d<f32>;
    @group(1) @binding(1) var normalTexture: texture_2d<f32>;
    @group(1) @binding(2) var metalRoughTexture: texture_2d<f32>;
    @group(1) @binding(3) var depthTexture: texture_depth_2d;

    fn worldPosFromDepth(texcoord: vec2f, depth: f32) -> vec3f {
      let clipSpacePos = vec4f((texcoord * 2 - 1) * vec2f(1, -1), depth, 1);
      let worldPos = camera.invViewProjection * clipSpacePos;
      return (worldPos.xyz / worldPos.w);
    }

    ${surfaceInfoStruct}

    const MIN_ROUGHNESS = 0.045;
    //const MIN_ROUGHNESS = 0.089; // For fp16

    fn surfaceInfoFromDeferred(pixelCoord: vec2u) -> SurfaceInfo {
      let targetSize = vec2f(textureDimensions(colorTexture, 0));

      let depth = textureLoad(depthTexture, pixelCoord, 0);

      var surface: SurfaceInfo;

      surface.worldPos = worldPosFromDepth((vec2f(pixelCoord) / targetSize), depth);
      surface.V = normalize(camera.position - surface.worldPos);

      let normal = textureLoad(normalTexture, pixelCoord, 0);
      surface.N = normalize(2 * normal.xyz - 1);

      let color = textureLoad(colorTexture, pixelCoord, 0);
      surface.ao = color.a;

      let metalRough = textureLoad(metalRoughTexture, pixelCoord, 0);
      surface.metal = metalRough.r;
      surface.rough = clamp(metalRough.g, MIN_ROUGHNESS, 1.0);

      surface.diffuseColor = color.rgb * (1 - surface.metal);
      surface.specularColor = color.rgb * surface.metal;

      let dielectricSpec = vec3f(0.04);
      surface.f0 = mix(dielectricSpec, color.rgb, vec3f(surface.metal));

      return surface;
    }

    ${PbrFunctions()}

    fn pointLightAttenuation(worldToLight: vec3f, lightRange: f32) -> f32 {
      let dist = length(worldToLight);
      return clamp(1 - pow(dist / lightRange, 4), 0, 1) / pow(dist, 2);
    }

    fn pbrDirectionalLight(light : DirectionalLight, surface: SurfaceInfo) -> vec3f {
      return pbrSurfaceColor(normalize(light.direction), surface, light.color, light.intensity, 1);
    }

    fn pbrPointLight(light : PointLight, surface: SurfaceInfo) -> vec3f {
      let worldToLight = light.position - surface.worldPos;

      let L = normalize(worldToLight);
      let attenuation = pointLightAttenuation(worldToLight, light.range);

      return pbrSurfaceColor(L, surface, light.color, light.intensity, attenuation);
    }

    @fragment
    fn fragmentMain(@builtin(position) pos : vec4f) -> @location(0) vec4f {
      let surface = surfaceInfoFromDeferred(vec2u(pos.xy));

      // Emmissive is handled directly in the gBuffer pass

#if ${useEnvLight}
      var Lo = pbrSurfaceColorIbl(surface);
#else
      var Lo = vec3f(0);
#endif

#if ${useDirLight}
      Lo += pbrDirectionalLight(lights.directionalLight, surface);
#endif

#if ${usePointLights}
      // Point lights
      for (var i: u32 = 0; i < lights.pointLightCount; i++) {
        let light = &lights.pointLights[i];

        // calculate per-light radiance and add to outgoing radiance Lo
        Lo += pbrPointLight(*light, surface);
      }
#endif

      return vec4f(Lo, 1);
    }
  `;
}
//# sourceMappingURL=deferred.js.map