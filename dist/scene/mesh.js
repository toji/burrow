import { SceneObject } from './node.js';
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
                skin: this.skin,
                transform: this.worldMatrix
            };
        }));
    }
}
//# sourceMappingURL=mesh.js.map