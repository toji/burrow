import { GeometryLayout } from '../geometry/geometry-layout.js';
import { RenderMaterial } from '../material/material.js';
export declare function pbrMaterialInputs(group: number): string;
export declare function getGBufferShader(layout: Readonly<GeometryLayout>, material: RenderMaterial): string;
export declare function getLightingShader(useEnvLight: boolean, usePointLights: boolean, useDirLight: boolean): any;
