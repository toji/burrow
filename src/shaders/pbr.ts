// Much of the shader used here was pulled from https://learnopengl.com/PBR/Lighting
// Thanks!
export function PbrFunctions() {
  return /* wgsl */`
    const PI = ${Math.PI};

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

//    fn lightRadiance(light : PointLight, surface: SurfaceInfo) -> vec3f {
//      let worldToLight = light.position - surface.worldPos;
//
//      let L = normalize(worldToLight);
//      let H = normalize(surface.V + L);
//
//      // cook-torrance brdf
//      let NDF = DistributionGGX(surface.N, H, surface.rough);
//      let G = GeometrySmith(surface.N, surface.V, L, surface.rough);
//      let F = FresnelSchlick(max(dot(H, surface.V), 0), surface.f0);
//
//      let kD = (vec3f(1) - F) * (1 - surface.metal);
//      let NdotL = max(dot(surface.N, L), 0.0);
//
//      let numerator = NDF * G * F;
//      let denominator = max(4 * max(dot(surface.N, surface.V), 0) * NdotL, 0.001);
//      let specular = numerator / vec3(denominator);
//
//      let atten = pointLightAttenuation(worldToLight, light.range);
//
//      // add to outgoing radiance Lo
//      let radiance = light.color * light.intensity * atten;
//      return (kD * surface.albedo / vec3(PI) + specular) * radiance * NdotL * surface.ao;
//    }
  `;
}