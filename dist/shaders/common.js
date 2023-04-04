export const cameraStruct = /* wgsl */ `
  struct Camera {
    projection: mat4x4f,
    view: mat4x4f,
    invViewProjection: mat4x4f,
    position: vec3f,
    time: f32,
  };
`;
export const lightStruct = /* wgsl */ `
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
//# sourceMappingURL=common.js.map