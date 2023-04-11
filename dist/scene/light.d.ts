import { Vec3, Vec3Like } from '../../third-party/gl-matrix/dist/src/index.js';
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
export declare class PointLight extends SceneObject {
    range: number;
    color: Vec3;
    intensity: number;
    constructor(options: PointLightInit);
    copy(): SceneObject;
    getRenderables(renderables: Renderables): void;
}
