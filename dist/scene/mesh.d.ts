import { Mat4 } from '../../third-party/gl-matrix/dist/src/index.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { RenderMaterial } from '../material/material.js';
import { SceneMesh } from '../renderer/deferred-renderer.js';
import { SceneObject, SceneObjectInit } from './node.js';
export interface MeshGeometry {
    geometry: RenderGeometry;
    material: RenderMaterial;
}
export declare class MeshSkin {
    inverseBindMatrices: Mat4[];
    joints: SceneObject[];
}
export interface MeshInit extends SceneObjectInit {
    geometry?: MeshGeometry[];
    skin?: MeshSkin;
}
export declare class Mesh extends SceneObject {
    geometry: MeshGeometry[];
    skin: MeshSkin;
    constructor(options: MeshInit);
    copy(): SceneObject;
    getRenderables(renderables?: SceneMesh[]): SceneMesh[];
}
