import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
export declare const cameraStruct = "\n  struct Camera {\n    projection: mat4x4f,\n    view: mat4x4f,\n    invViewProjection: mat4x4f,\n    position: vec3f,\n    time: f32,\n  };\n";
export declare const lightStruct = "\n  struct PointLight {\n    position: vec3f,\n    range: f32,\n    color: vec3f,\n    intensity: f32,\n  };\n\n  struct Lights {\n    pointLightCount: u32,\n    pointLights: array<PointLight>,\n  };\n";
export declare const surfaceInfoStruct = "\n  struct SurfaceInfo {\n    worldPos: vec3f,\n    V: vec3f, // normalized vector from the shading location to the eye\n    N: vec3f, // surface normal in the world space\n    specularColor: vec3f,\n    diffuseColor: vec3f,\n    metal: f32,\n    rough: f32,\n    f0: vec3f,\n    ao: f32,\n  };\n";
export declare function pbrMaterialInputs(group: number): string;
export declare function getGBufferShader(layout: Readonly<GeometryLayout>, material: RenderMaterial): string;
export declare const lightingShader: string;
