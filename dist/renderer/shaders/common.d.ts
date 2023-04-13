import { GeometryLayout } from '../../geometry/geometry-layout.js';
export declare const cameraStruct = "\n  struct Camera {\n    projection: mat4x4f,\n    view: mat4x4f,\n    invViewProjection: mat4x4f,\n    position: vec3f,\n    time: f32,\n  };\n";
export declare const lightStruct = "\n  struct DirectionalLight {\n    direction: vec3f,\n    color: vec3f,\n    intensity: f32,\n  };\n\n  struct PointLight {\n    position: vec3f,\n    range: f32,\n    color: vec3f,\n    intensity: f32,\n  };\n\n  struct Lights {\n    directionalLight: DirectionalLight,\n    pointLightCount: u32,\n    pointLights: array<PointLight>,\n  };\n";
export declare const skinningFunctions = "\n  fn getSkinMatrix(joints: vec4u, weights: vec4f) -> mat4x4<f32> {\n    let joint0 = jointMat[joints.x] * invBindMat[joints.x];\n    let joint1 = jointMat[joints.y] * invBindMat[joints.y];\n    let joint2 = jointMat[joints.z] * invBindMat[joints.z];\n    let joint3 = jointMat[joints.w] * invBindMat[joints.w];\n\n    let skinMatrix = joint0 * weights.x +\n                     joint1 * weights.y +\n                     joint2 * weights.z +\n                     joint3 * weights.w;\n    return skinMatrix;\n  }\n";
export declare const ditherFunctions = "\n  const bayer_n = 4u;\n  const bayer_matrix_4x4 = mat4x4f(\n      -0.5,       0,  -0.375,   0.125,\n      0.25,   -0.25,   0.375,  -0.125,\n    -0.3125,  0.1875, -0.4375,  0.0625,\n    0.4375, -0.0625,  0.3125, -0.1875\n  );\n\n  fn dither(value: f32, pixelCoord: vec2u) -> f32 {\n    let r = 1.0;\n    var d = value + (r * bayer_matrix_4x4[pixelCoord.y % bayer_n][pixelCoord.x % bayer_n]);\n\n    d = d * 0.99 + 0.05;\n\n    return select(0.0, 1.0, d > 0.5);\n  }\n";
export declare function pbrMaterialInputs(group: number): string;
export declare function getCommonVertexShader(layout: Readonly<GeometryLayout>, skinned?: boolean): any;
