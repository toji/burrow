import { Mat4 } from '../../third-party/gl-matrix/dist/src/index.js';
import { RenderGeometry } from '../geometry/geometry.js';
import { RenderSkin } from '../geometry/skin.js';
import { RenderMaterial } from '../material/material.js';
import { Renderables, SceneMesh } from '../renderer/deferred-renderer.js';
import { SceneObject, SceneObjectInit } from './node.js';

export interface MeshGeometry {
  geometry: RenderGeometry,
  material: RenderMaterial,
}

export interface MeshInit extends SceneObjectInit {
  geometry?: MeshGeometry[];
  skin?: RenderSkin;
}

export class Mesh extends SceneObject {
  geometry: MeshGeometry[];
  skin: RenderSkin;

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

  getRenderables(renderables: Renderables) {
    super.getRenderables(renderables);
    if (!this.visible) { return; }
    renderables.meshes.push(...this.geometry.map((geometry) => { return {
      ...geometry,
      skin: this.skin,
      transform: this.worldMatrix
    }}));
  }
}