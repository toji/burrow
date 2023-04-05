// @ts-ignore
import { wgsl } from 'https://cdn.jsdelivr.net/npm/wgsl-preprocessor@1.0/wgsl-preprocessor.js';

import { GeometryLayout } from '../geometry/geometry-layout.js';
import { AttributeLocation } from '../geometry/geometry.js';

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
    directionalLight: DirectionalLight,
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

export function getCommonVertexShader(layout: Readonly<GeometryLayout>) {
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
      @location(0) worldPos : vec3f,
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