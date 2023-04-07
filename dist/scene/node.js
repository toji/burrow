import { Mat4, Quat, Vec3 } from '../../third-party/gl-matrix/dist/src/index.js';
const DEFAULT_TRANSLATION = new Vec3();
const DEFAULT_ROTATION = new Quat(0, 0, 0, 1);
const DEFAULT_SCALE = new Vec3(1, 1, 1);
export class Transform {
    translation;
    rotation;
    scale;
    dirty = true;
    #localMatrix = new Mat4();
    constructor(values = {}) {
        this.translation = new Vec3(values.translation ?? DEFAULT_TRANSLATION);
        this.rotation = new Quat(values.rotation ?? DEFAULT_ROTATION);
        this.scale = new Vec3(values.scale ?? DEFAULT_SCALE);
    }
    copy() {
        return new Transform({
            translation: this.translation,
            rotation: this.rotation,
            scale: this.scale,
        });
    }
    getLocalMatrix() {
        if (this.dirty) {
            Mat4.fromRotationTranslationScale(this.#localMatrix, this.rotation, this.translation, this.scale);
            this.dirty = false;
        }
        return this.#localMatrix;
    }
}
export class MatrixTransform {
    matrix;
    dirty = true;
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
    get dirty() { return false; }
    getLocalMatrix() {
        return IDENTITY_MATRIX;
    }
}
export class SceneObject {
    label;
    // TODO: This right here is probably a good argument for embracing ECS again.
    animationTarget;
    visible = true;
    #parent = null;
    #children;
    #transform;
    #worldMatrixDirty = true;
    #worldMatrix = new Mat4();
    #worldPos;
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
    addChild(...children) {
        for (const child of children) {
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
    }
    removeChild(...children) {
        for (const child of children) {
            const removed = this.#children?.delete(child);
            if (removed) {
                child.#parent = null;
                child.#makeDirty();
            }
        }
    }
    // TODO: Ripe for optimization!
    getRenderables(renderables) {
        if (!this.visible) {
            return;
        }
        if (this.#children) {
            for (const child of this.#children) {
                child.getRenderables(renderables);
            }
        }
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
        if (this.#worldMatrixDirty || this.transform.dirty) {
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
    get worldPosition() {
        if (!this.#worldPos) {
            this.#worldPos = new Vec3();
        }
        return Vec3.transformMat4(this.#worldPos, DEFAULT_TRANSLATION, this.worldMatrix);
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