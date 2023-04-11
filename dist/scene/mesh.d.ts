import { RenderGeometry } from '../geometry/geometry.js';
import { RenderSkin } from '../geometry/skin.js';
import { RenderMaterial } from '../material/material.js';
import { Renderables } from '../renderer/deferred-renderer.js';
import { SceneObject, SceneObjectInit } from './object.js';
export interface MeshGeometry {
    geometry: RenderGeometry;
    material: RenderMaterial;
}
export interface MeshInit extends SceneObjectInit {
    geometry?: MeshGeometry[];
    skin?: RenderSkin;
}
export declare class Mesh extends SceneObject {
    geometry: MeshGeometry[];
    skin: RenderSkin;
    constructor(options: MeshInit);
    copy(): SceneObject;
    getRenderables(renderables: Renderables): void;
}
