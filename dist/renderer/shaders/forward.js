// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';
import { AttributeLocation } from '../../geometry/geometry.js';
import { getCommonVertexShader, lightStruct, pbrMaterialInputs } from './common.js';
import { PbrFunctions, surfaceInfoStruct } from './pbr.js';
export function getForwardShader(layout, material, skinned) {
    const locationsUsed = layout.locationsUsed;
    if (material.unlit) {
        return wgsl `
      ${getCommonVertexShader(layout, skinned)}

      ${pbrMaterialInputs(/*@group*/ 2)}

      @fragment
      fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
        let baseColor = material.baseColorFactor * textureSample(baseColorTexture, pbrSampler, input.texcoord);
        let color = input.color * baseColor.rgb;

#if ${material.discard}
        if (baseColor.a < material.alphaCutoff) {
          discard;
        }
#endif

        return vec4f(color, baseColor.a);
      }
    `;
    }
    return wgsl `
    ${getCommonVertexShader(layout)}

    ${pbrMaterialInputs(/*@group*/ 2)}

    ${lightStruct}
    @group(0) @binding(1) var<storage> lights : Lights;

    @group(0) @binding(2) var environmentSampler : sampler;
    @group(0) @binding(3) var environmentTexture : texture_cube<f32>;

    ${surfaceInfoStruct}

    const MIN_ROUGHNESS = 0.045;
    fn surfaceInfoFromForward(input: VertexOutput) -> SurfaceInfo {
      var surface: SurfaceInfo;

      surface.worldPos = input.worldPos;
      surface.V = normalize(camera.position - surface.worldPos);

#if ${locationsUsed.has(AttributeLocation.tangent)}
      let tbn = mat3x3f(input.tangent, input.bitangent, input.normal);
      let N = textureSample(normalTexture, pbrSampler, input.texcoord).rgb;
      let normal = tbn * (2 * N - 1);
#else
      let normal = input.normal;
#endif

      surface.N = normalize(normal);

      let baseColor = material.baseColorFactor * textureSample(baseColorTexture, pbrSampler, input.texcoord);
      let color = input.color * baseColor.rgb;
      surface.alpha = baseColor.a;

      surface.ao = material.occlusionStrength * textureSample(occlusionTexture, pbrSampler, input.texcoord).r;

      let metalRough = material.metallicRoughnessFactor * textureSample(metallicRoughnessTexture, pbrSampler, input.texcoord).bg;
      surface.metal = metalRough.r;
      surface.rough = clamp(metalRough.g, MIN_ROUGHNESS, 1.0);

      surface.diffuseColor = color * (1 - surface.metal);
      surface.specularColor = color * surface.metal;

      let dielectricSpec = vec3f(0.04);
      surface.f0 = mix(dielectricSpec, color.rgb, vec3f(surface.metal));

      return surface;
    }

    ${PbrFunctions()}

    @fragment
    fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
      let surface = surfaceInfoFromForward(input);
      if (surface.alpha < 0.05) {
        discard;
      }

      var Lo = pbrSurfaceColorIbl(surface);

      if (lights.directionalLight.intensity > 0) {
        Lo += pbrDirectionalLight(lights.directionalLight, surface);
      }

      // Point lights
      for (var i: u32 = 0; i < lights.pointLightCount; i++) {
        let light = &lights.pointLights[i];

        // calculate per-light radiance and add to outgoing radiance Lo
        Lo += pbrPointLight(*light, surface);
      }

      let emmisive = material.emissiveFactor * textureSample(emissiveTexture, pbrSampler, input.texcoord).rgb;
      Lo += (surface.diffuseColor * surface.ao * * lights.ambient) + emmisive;

      return vec4f(Lo, surface.alpha);
    }
  `;
}
//# sourceMappingURL=forward.js.map