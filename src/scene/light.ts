import { Vec3, Vec3Like } from '../../node_modules/gl-matrix/dist/esm/index.js';
import { Renderables } from '../renderer/deferred-renderer.js';
import { SceneObject, SceneObjectInit } from './object.js';

export interface DirectionalLight {
  direction: Vec3Like;
  color?: Vec3Like;
  intensity?: number;
}

export interface PointLightInit extends SceneObjectInit {
  range?: number;
  color?: Vec3Like;
  intensity?: number;
}

export class PointLight extends SceneObject {
  range: number;
  color: Vec3;
  intensity: number;

  constructor(options: PointLightInit) {
    super(options);

    this.range = options.range;
    this.color = new Vec3(options.color ?? [1, 1, 1]);
    this.intensity = options.intensity ?? 1;
  }

  copy(): SceneObject {
    const object = new PointLight({
      label: this.label,
      transform: this.transform.copy(),
      range: this.range,
      color: this.color,
      intensity: this.intensity,
    });

    this.copyChildren(object);

    return object;
  }

  getRenderables(renderables: Renderables) {
    super.getRenderables(renderables);
    if (!this.visible) { return; }
    renderables.pointLights.push(this);
  }
}