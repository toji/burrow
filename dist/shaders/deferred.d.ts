import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
export declare const cameraStruct = "\n  struct Camera {\n    projection: mat4x4f,\n    view: mat4x4f,\n    invViewProjection: mat4x4f,\n    position: vec3f,\n    time: f32,\n  };\n";
export declare const lightStruct = "\n  struct DirectionalLight {\n    direction: vec3f,\n    color: vec3f,\n    intensity: f32,\n  };\n\n  struct PointLight {\n    position: vec3f,\n    range: f32,\n    color: vec3f,\n    intensity: f32,\n  };\n\n  struct Lights {\n    directionalLight: DirectionalLight,\n    pointLightCount: u32,\n    pointLights: array<PointLight>,\n  };\n";
export declare function pbrMaterialInputs(group: number): string;
export declare function getGBufferShader(layout: Readonly<GeometryLayout>, material: RenderMaterial): string;
export declare function getLightingShader(useEnvLight: boolean, usePointLights: boolean, useDirLight: boolean): any;
