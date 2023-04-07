import { Mat4 } from '../../third-party/gl-matrix/dist/src/index.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { RenderMaterial } from '../material/material.js';
import { SceneMesh } from '../renderer/deferred-renderer.js';
import { SceneObject, SceneObjectInit } from './node.js';

export interface MeshGeometry {
  geometry: RenderGeometry,
  material: RenderMaterial,
}

export class MeshSkin {
  inverseBindMatrices: Mat4[];
  joints: SceneObject[];
}

export interface MeshInit extends SceneObjectInit {
  geometry?: MeshGeometry[];
  skin?: MeshSkin;
}

export class Mesh extends SceneObject {
  geometry: MeshGeometry[];
  skin: MeshSkin;

  constructor(options: MeshInit) {
    super(options);

    this.geometry = options.geometry || [];
    if (!Array.isArray(this.geometry)) {
      this.geometry = [this.geometry];
    }
  }

  copy(): SceneObject {
    const object = new Mesh({
      label: this.label,
      transform: this.transform.copy(),
      geometry: this.geometry,
    });

    this.copyChildren(object);

    return object;
  }

  getRenderables(renderables: SceneMesh[] = []): SceneMesh[] {
    renderables.push(...this.geometry.map((geometry) => { return {
      ...geometry,
      transform: this.worldMatrix
    }}));
    return super.getRenderables(renderables);
  }
}