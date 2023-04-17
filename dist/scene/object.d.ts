import { Mat4, Quat, Vec3, Vec3Like, QuatLike } from '../../node_modules/gl-matrix/dist/esm/index.js';
import { AnimationTarget } from '../animation/animation.js';
import { Renderables } from '../renderer/deferred-renderer.js';
export interface AbstractTransform {
    dirty: boolean;
    copy(): AbstractTransform;
    getLocalMatrix(): Readonly<Mat4>;
}
interface TransformInit {
    translation?: Vec3Like;
    rotation?: QuatLike;
    scale?: Vec3Like;
}
export declare class Transform implements AbstractTransform {
    #private;
    translation: Vec3;
    rotation: Quat;
    scale: Vec3;
    dirty: boolean;
    constructor(values?: TransformInit);
    copy(): AbstractTransform;
    getLocalMatrix(): Readonly<Mat4>;
}
export declare class MatrixTransform implements AbstractTransform {
    matrix: Mat4;
    dirty: boolean;
    constructor(matrix?: Mat4);
    copy(): AbstractTransform;
    getLocalMatrix(): Readonly<Mat4>;
}
export declare class IdentityTransform implements AbstractTransform {
    copy(): AbstractTransform;
    get dirty(): boolean;
    getLocalMatrix(): Readonly<Mat4>;
}
export interface SceneObjectInit {
    label?: string;
    transform?: AbstractTransform;
    parent?: SceneObject;
}
export declare class SceneObject {
    #private;
    label: string;
    animationTarget: AnimationTarget;
    visible: boolean;
    constructor(options?: SceneObjectInit);
    copy(): SceneObject;
    copyChildren(parent: SceneObject): void;
    addChild(...children: SceneObject[]): void;
    removeChild(...children: SceneObject[]): void;
    getRenderables(renderables: Renderables): void;
    get children(): SceneObject[];
    get parent(): SceneObject;
    get transform(): Readonly<AbstractTransform>;
    set transform(transform: AbstractTransform);
    get localMatrix(): Readonly<Mat4>;
    get worldMatrix(): Readonly<Mat4>;
    get worldPosition(): Readonly<Vec3>;
}
export {};
