import { Mat4, Quat, Vec3, Vec3Like } from '../../third-party/gl-matrix/dist/src/index.js';
import { QuatLike } from '../../third-party/gl-matrix/dist/src/quat.js';
import { AnimationTarget } from '../animation/animation.js';
import { SceneMesh } from '../renderer/deferred-renderer.js';
export interface AbstractTransform {
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
    constructor(values?: TransformInit);
    markDirty(): void;
    copy(): AbstractTransform;
    getLocalMatrix(): Readonly<Mat4>;
}
export declare class MatrixTransform implements AbstractTransform {
    matrix: Mat4;
    constructor(matrix?: Mat4);
    copy(): AbstractTransform;
    getLocalMatrix(): Readonly<Mat4>;
}
export declare class IdentityTransform implements AbstractTransform {
    copy(): AbstractTransform;
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
    constructor(options?: SceneObjectInit);
    copy(): SceneObject;
    copyChildren(parent: SceneObject): void;
    addChild(child: SceneObject): void;
    removeChild(child: SceneObject): void;
    getRenderables(renderables?: SceneMesh[]): SceneMesh[];
    get children(): SceneObject[];
    get parent(): SceneObject;
    get transform(): Readonly<AbstractTransform>;
    set transform(transform: AbstractTransform);
    get localMatrix(): Readonly<Mat4>;
    get worldMatrix(): Readonly<Mat4>;
}
export {};
