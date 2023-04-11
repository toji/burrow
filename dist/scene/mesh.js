import { SceneObject } from './object.js';
export class Mesh extends SceneObject {
    geometry;
    skin;
    constructor(options) {
        super(options);
        this.geometry = options.geometry || [];
        if (!Array.isArray(this.geometry)) {
            this.geometry = [this.geometry];
        }
    }
    copy() {
        const object = new Mesh({
            label: this.label,
            transform: this.transform.copy(),
            geometry: this.geometry,
            skin: this.skin?.clone(),
        });
        this.copyChildren(object);
        return object;
    }
    getRenderables(renderables) {
        super.getRenderables(renderables);
        if (!this.visible) {
            return;
        }
        renderables.meshes.push(...this.geometry.map((geometry) => {
            return {
                ...geometry,
                skin: this.skin ? { skin: this.skin, animationTarget: this.animationTarget } : undefined,
                transform: this.worldMatrix
            };
        }));
    }
}
//# sourceMappingURL=mesh.js.map