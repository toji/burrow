// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';

import { GeometryLayout } from '../../geometry/geometry-layout.js';
import { AttributeLocation } from '../../geometry/geometry.js';

export const cameraStruct = /* wgsl */`
  struct Camera {
    projection: mat4x4f,
    view: mat4x4f,
    invViewProjection: mat4x4f,
    invProjection: mat4x4f,
    position: vec3f,
    time: f32,
    zRange: vec2f,
  };
`;

export const lightStruct = /* wgsl */`
  struct DirectionalLight {
    direction: vec3f,
    color: vec3f,
    intensity: f32,
  };

  struct PointLight {
    position: vec3f,
    range: f32,
    color: vec3f,
    intensity: f32,
  };

  struct Lights {
    ambient: vec3f,
    directionalLight: DirectionalLight,
    pointLightCount: u32,
    pointLights: array<PointLight>,
  };
`;

export const skinningFunctions = /* wgsl */`
  fn getSkinMatrix(joints: vec4u, weights: vec4f) -> mat4x4<f32> {
    let joint0 = jointMat[joints.x] * invBindMat[joints.x];
    let joint1 = jointMat[joints.y] * invBindMat[joints.y];
    let joint2 = jointMat[joints.z] * invBindMat[joints.z];
    let joint3 = jointMat[joints.w] * invBindMat[joints.w];

    let skinMatrix = joint0 * weights.x +
                     joint1 * weights.y +
                     joint2 * weights.z +
                     joint3 * weights.w;
    return skinMatrix;
  }
`;

export const ditherFunctions = /* wgsl */`
  const bayer_n = 4u;
  const bayer_matrix_4x4 = mat4x4f(
      -0.5,       0,  -0.375,   0.125,
      0.25,   -0.25,   0.375,  -0.125,
    -0.3125,  0.1875, -0.4375,  0.0625,
    0.4375, -0.0625,  0.3125, -0.1875
  );

  fn dither(value: f32, pixelCoord: vec2u) -> f32 {
    let r = 1.0;
    var d = value + (r * bayer_matrix_4x4[pixelCoord.y % bayer_n][pixelCoord.x % bayer_n]);

    d = d * 0.99 + 0.05;

    return select(0.0, 1.0, d > 0.5);
  }
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

export function getCommonVertexShader(layout: Readonly<GeometryLayout>, skinned: boolean = false) {
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
#if ${locationsUsed.has(AttributeLocation.joints)}
      @location(${AttributeLocation.joints}) joints: vec4u,
#endif
#if ${locationsUsed.has(AttributeLocation.weights)}
      @location(${AttributeLocation.weights}) weights: vec4f,
#endif
    };

    struct VertexOutput {
      @builtin(position) position : vec4f,
      @location(0) worldPos : vec3f,
      @location(1) color : vec3f,
      @location(2) normal : vec3f,
      @location(3) tangent : vec3f,
      @location(4) bitangent : vec3f,
      @location(5) texcoord : vec2f,
    };

#if ${skinned}
    @group(3) @binding(0) var<storage> invBindMat : array<mat4x4f>;
    @group(3) @binding(1) var<storage> jointMat : array<mat4x4f>;

    ${skinningFunctions}
#endif

    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {
      var output : VertexOutput;

#if ${skinned}
      let model = getSkinMatrix(input.joints, input.weights);
#else
      let model = instanceMat[input.instance];
#endif

      let worldPos = model * input.position;
      output.position = camera.projection * camera.view * worldPos;
      output.worldPos = worldPos.xyz;

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
  `;
}