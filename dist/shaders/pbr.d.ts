export declare const surfaceInfoStruct = "\n  struct SurfaceInfo {\n    worldPos: vec3f,\n    V: vec3f, // normalized vector from the shading location to the eye\n    N: vec3f, // surface normal in the world space\n    specularColor: vec3f,\n    diffuseColor: vec3f,\n    metal: f32,\n    rough: f32,\n    f0: vec3f,\n    ao: f32,\n  };\n";
export declare function PbrFunctions(): string;
