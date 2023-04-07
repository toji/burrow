import { Mat4, Quat, Vec3 } from '../../third-party/gl-matrix/dist/src/index.js';
const DEFAULT_TRANSLATION = new Vec3();
const DEFAULT_ROTATION = new Quat(0, 0, 0, 1);
const DEFAULT_SCALE = new Vec3(1, 1, 1);
export class Transform {
    translation;
    rotation;
    scale;
    #localMatrixDirty = true;
    #localMatrix = new Mat4();
    constructor(values = {}) {
        this.translation = new Vec3(values.translation ?? DEFAULT_TRANSLATION);
        this.rotation = new Quat(values.rotation ?? DEFAULT_ROTATION);
        this.scale = new Vec3(values.scale ?? DEFAULT_SCALE);
    }
    markDirty() {
        this.#localMatrixDirty = false;
    }
    copy() {
        return new Transform({
            translation: this.translation,
            rotation: this.rotation,
            scale: this.scale,
        });
    }
    getLocalMatrix() {
        if (this.#localMatrixDirty) {
            Mat4.fromRotationTranslationScale(this.#localMatrix, this.rotation, this.translation, this.scale);
            this.#localMatrixDirty = false;
        }
        return this.#localMatrix;
    }
}
export class MatrixTransform {
    matrix;
    constructor(matrix) {
        this.matrix = new Mat4(matrix);
    }
    copy() {
        return new MatrixTransform(this.matrix);
    }
    getLocalMatrix() {
        return this.matrix;
    }
}
const IDENTITY_MATRIX = new Mat4();
export class IdentityTransform {
    copy() {
        return new IdentityTransform();
    }
    getLocalMatrix() {
        return IDENTITY_MATRIX;
    }
}
export class SceneObject {
    label;
    // TODO: This right here is probably a good argument for embracing ECS again.
    animationTarget;
    #parent = null;
    #children;
    #transform;
    #worldMatrixDirty = true;
    #worldMatrix = new Mat4();
    constructor(options = {}) {
        this.label = options.label;
        this.#transform = options.transform || new IdentityTransform();
        if (options.parent) {
            options.parent.addChild(this);
        }
    }
    copy() {
        const object = new SceneObject({
            label: this.label,
            transform: this.#transform.copy(),
        });
        this.copyChildren(object);
        return object;
    }
    copyChildren(parent) {
        if (this.#children) {
            for (const child of this.#children) {
                parent.addChild(child.copy());
            }
        }
    }
    addChild(child) {
        if (child.parent && child.parent != this) {
            child.parent.removeChild(child);
        }
        if (!this.#children) {
            this.#children = new Set();
        }
        this.#children.add(child);
        child.#parent = this;
        child.#makeDirty();
    }
    removeChild(child) {
        const removed = this.#children?.delete(child);
        if (removed) {
            child.#parent = null;
            child.#makeDirty();
        }
    }
    // TODO: Ripe for optimization!
    getRenderables(renderables = []) {
        if (this.#children) {
            for (const child of this.#children) {
                child.getRenderables(renderables);
            }
        }
        return renderables;
    }
    get children() {
        return [...this.#children?.values()] || [];
    }
    get parent() {
        return this.#parent;
    }
    get transform() {
        return this.#transform;
    }
    set transform(transform) {
        this.#transform = transform;
        this.#makeDirty();
    }
    get localMatrix() {
        return this.#transform.getLocalMatrix();
    }
    get worldMatrix() {
        if (this.#worldMatrixDirty) {
            if (!this.parent) {
                this.#worldMatrix.set(this.localMatrix);
            }
            else {
                Mat4.mul(this.#worldMatrix, this.parent.worldMatrix, this.localMatrix);
            }
            this.#worldMatrixDirty = false;
        }
        return this.#worldMatrix;
    }
    #makeDirty() {
        if (this.#worldMatrixDirty) {
            return;
        }
        this.#worldMatrixDirty = true;
        if (this.#children) {
            for (const child of this.#children) {
                child.#makeDirty();
            }
        }
    }
}
//# sourceMappingURL=node.js.map