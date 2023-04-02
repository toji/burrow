// Much of the shader used here was pulled from https://learnopengl.com/PBR/Lighting
// Thanks!
export function PbrFunctions() {
    return /* wgsl */ `
    const PI = ${Math.PI};

    //------------------
    // Dynamic lighting
    //------------------

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

    fn pbrSurfaceColor(L: vec3f, surface: SurfaceInfo, lightColor: vec3f, lightIntensity: f32, attenuation: f32) -> vec3f {
      let H = normalize(surface.V + L);

      // cook-torrance brdf
      let NDF = DistributionGGX(surface.N, H, surface.rough);
      let G = GeometrySmith(surface.N, surface.V, L, surface.rough);
      let F = FresnelSchlick(max(dot(H, surface.V), 0), surface.f0);

      let kD = (vec3f(1) - F) * (1 - surface.metal);
      let NdotL = max(dot(surface.N, L), 0.0);

      let numerator = NDF * G * F;
      let denominator = max(4 * max(dot(surface.N, surface.V), 0) * NdotL, 0.001);
      let specular = numerator / vec3(denominator);

      let Fd = surface.diffuseColor / PI;

      // add to outgoing radiance Lo
      let radiance = lightColor * lightIntensity * attenuation;
      return (kD * Fd + specular) * radiance * NdotL * surface.ao;
    }

    //----------------------
    // Image-based lighting
    //----------------------

    fn getSpecularLightColor(R: vec3f, roughness: f32) -> vec3f {
      let envLevels = f32(textureNumLevels(environmentTexture));

      let rough = envLevels * roughness * (2.0 - roughness);

      return textureSampleLevel(environmentTexture, environmentSampler, R, rough).rgb;
    }

    fn getDiffuseLightColor(N: vec3f) -> vec3f {
      let diffuseLevel = f32(textureNumLevels(environmentTexture) - 1);
      return textureSampleLevel(environmentTexture, environmentSampler, N, diffuseLevel).rgb;
    }

    fn FresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
      return F0 + (max(vec3f(1 - roughness), F0) - F0) * pow(clamp(1 - cosTheta, 0, 1), 5);
    }

    // From https://www.unrealengine.com/en-US/blog/physically-based-shading-on-mobile
    fn envBRDFApprox(roughness: f32, NdotV: f32) -> vec2f {
      let c0 = vec4f(-1, -0.0275, -0.572, 0.022);
      let c1 = vec4f(1, 0.0425, 1.04, -0.04);
      let r = roughness * c0 + c1;
      let a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
      return vec2f(-1.04, 1.04) * a004 + r.zw;
    }

    fn pbrSurfaceColorIbl(surface: SurfaceInfo) -> vec3f {
      let NdotV = max(dot(surface.N, surface.V), 0);
      let R = reflect(-surface.V, surface.N);
      //let R = 2 * dot( surface.V, surface.N ) * surface.N - surface.V;

      let kS = FresnelSchlickRoughness(NdotV, surface.f0, surface.rough);
      let kD = (1 - kS) * (1 - surface.metal);
      let irradiance = getDiffuseLightColor(surface.N);
      let diffuse    = irradiance * surface.diffuseColor;

      let prefilteredColor = getSpecularLightColor(R, surface.rough);
      let envBrdf = envBRDFApprox(surface.rough, NdotV);
      let specular = prefilteredColor * (surface.specularColor * envBrdf.x + envBrdf.y);

      //let specular = vec3f(0);

      let ambient    = (kD * diffuse + specular) * surface.ao;
      return ambient;
    }
  `;
}
//# sourceMappingURL=pbr.js.map