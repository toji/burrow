import { Mat4, Quat, Vec3, Vec3Like } from '../../third-party/gl-matrix/dist/src/index.js';
import { QuatLike } from '../../third-party/gl-matrix/dist/src/quat.js';
import { AnimationTarget } from '../animation/animation.js';
import { Renderables, SceneMesh } from '../renderer/deferred-renderer.js';

export interface AbstractTransform {
  dirty: boolean;
  copy(): AbstractTransform;
  getLocalMatrix(): Readonly<Mat4>;
}

interface TransformInit {
  translation?: Vec3Like,
  rotation?: QuatLike,
  scale?: Vec3Like
}

const DEFAULT_TRANSLATION = new Vec3();
const DEFAULT_ROTATION = new Quat(0, 0, 0, 1);
const DEFAULT_SCALE = new Vec3(1, 1, 1);

export class Transform implements AbstractTransform {
  translation: Vec3;
  rotation: Quat;
  scale: Vec3;

  dirty = true;
  #localMatrix = new Mat4();

  constructor(values: TransformInit = {}) {
    this.translation = new Vec3(values.translation ?? DEFAULT_TRANSLATION);
    this.rotation = new Quat(values.rotation ?? DEFAULT_ROTATION);
    this.scale = new Vec3(values.scale ?? DEFAULT_SCALE);
  }

  copy(): AbstractTransform {
    return new Transform({
      translation: this.translation,
      rotation: this.rotation,
      scale: this.scale,
    });
  }

  getLocalMatrix(): Readonly<Mat4> {
    if (this.dirty) {
      Mat4.fromRotationTranslationScale(this.#localMatrix,
        this.rotation,
        this.translation,
        this.scale);
      this.dirty = false;
    }
    return this.#localMatrix;
  }
}

export class MatrixTransform implements AbstractTransform {
  matrix: Mat4;
  dirty = true;

  constructor(matrix?: Mat4) {
    this.matrix = new Mat4(matrix);
  }

  copy(): AbstractTransform {
    return new MatrixTransform(this.matrix);
  }

  getLocalMatrix(): Readonly<Mat4> {
    return this.matrix;
  }
}

const IDENTITY_MATRIX = new Mat4();

export class IdentityTransform implements AbstractTransform {
  copy(): AbstractTransform {
    return new IdentityTransform();
  }

  get dirty(): boolean { return false; }

  getLocalMatrix(): Readonly<Mat4> {
    return IDENTITY_MATRIX;
  }
}

export interface SceneObjectInit {
  label?: string;
  transform?: AbstractTransform;
  parent?: SceneObject;
}

export class SceneObject {
  label: string;

  // TODO: This right here is probably a good argument for embracing ECS again.
  animationTarget: AnimationTarget;
  visible: boolean = true;

  #parent: SceneObject = null;
  #children: Set<SceneObject>;

  #transform: AbstractTransform;

  #worldMatrixDirty = true;
  #worldMatrix: Mat4 = new Mat4();
  #worldPos: Vec3;

  constructor(options: SceneObjectInit = {}) {
    this.label = options.label;
    this.#transform = options.transform || new IdentityTransform();

    if (options.parent) {
      options.parent.addChild(this);
    }
  }

  copy(): SceneObject {
    const object = new SceneObject({
      label: this.label,
      transform: this.#transform.copy(),
    });

    this.copyChildren(object);

    return object;
  }

  copyChildren(parent: SceneObject) {
    if (this.#children) {
      for (const child of this.#children) {
        parent.addChild(child.copy());
      }
    }
  }

  addChild(...children: SceneObject[]) {
    for (const child of children) {
      if (child.parent && child.parent != this) {
        child.parent.removeChild(child);
      }

      if (!this.#children) { this.#children = new Set(); }
      this.#children.add(child);
      child.#parent = this;
      child.#makeDirty();
    }
  }

  removeChild(...children: SceneObject[]) {
    for (const child of children) {
      const removed = this.#children?.delete(child);
      if (removed) {
        child.#parent = null;
        child.#makeDirty();
      }
    }
  }

  // TODO: Ripe for optimization!
  getRenderables(renderables: Renderables) {
    if (!this.visible) { return; }
    if (this.#children) {
      for (const child of this.#children) {
        child.getRenderables(renderables);
      }
    }
  }

  get children(): SceneObject[] {
    return [...this.#children?.values()] || [];
  }

  get parent(): SceneObject {
    return this.#parent;
  }

  get transform(): Readonly<AbstractTransform> {
    return this.#transform;
  }

  set transform(transform: AbstractTransform) {
    this.#transform = transform;
    this.#makeDirty();
  }

  get localMatrix(): Readonly<Mat4> {
    return this.#transform.getLocalMatrix();
  }

  get worldMatrix(): Readonly<Mat4> {
    if (this.#worldMatrixDirty || this.transform.dirty) {
      if (!this.parent) {
        this.#worldMatrix.set(this.localMatrix);
      } else {
        Mat4.mul(this.#worldMatrix, this.parent.worldMatrix, this.localMatrix);
      }
      this.#worldMatrixDirty = false;
    }
    return this.#worldMatrix;
  }

  get worldPosition(): Readonly<Vec3> {
    if (!this.#worldPos) {
      this.#worldPos = new Vec3();
    }
    return Vec3.transformMat4(this.#worldPos, DEFAULT_TRANSLATION, this.worldMatrix) as Vec3;
  }

  #makeDirty() {
    if (this.#worldMatrixDirty) { return; }
    this.#worldMatrixDirty = true;

    if (this.#children) {
      for (const child of this.#children) {
        child.#makeDirty();
      }
    }
  }
}