// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';

import { GeometryLayout } from '../geometry/geometry-layout.js';
import { AttributeLocation } from '../geometry/geometry.js';
import { RenderMaterial } from '../material/material.js';
import { getCommonVertexShader, lightStruct, pbrMaterialInputs } from './common.js';
import { PbrFunctions, surfaceInfoStruct } from './pbr.js';

export function getForwardShader(layout: Readonly<GeometryLayout>, material: RenderMaterial): string {
  const locationsUsed = layout.locationsUsed;

  return wgsl`
    ${getCommonVertexShader(layout)}

    ${pbrMaterialInputs(/*@group*/ 2)}

    ${lightStruct}
    @group(0) @binding(1) var<storage> lights : Lights;

    const lightAmbient = vec3f(0.01);

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

      var Lo = pbrSurfaceColorIbl(surface);

      // Point lights
      for (var i: u32 = 0; i < lights.pointLightCount; i++) {
        let light = &lights.pointLights[i];

        // calculate per-light radiance and add to outgoing radiance Lo
        Lo += pbrPointLight(*light, surface);
      }

      Lo += material.emissiveFactor * textureSample(emissiveTexture, pbrSampler, input.texcoord).rgb;

      return vec4f(Lo, surface.alpha);
    }
  `;
}