import { Vec3 } from '../../third-party/gl-matrix/dist/src/index.js';
import { SceneObject } from './node.js';
export class PointLight extends SceneObject {
    range;
    color;
    intensity;
    constructor(options) {
        super(options);
        this.range = options.range;
        this.color = new Vec3(options.color ?? [1, 1, 1]);
        this.intensity = options.intensity ?? 1;
    }
    copy() {
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
    getRenderables(renderables) {
        super.getRenderables(renderables);
        if (!this.visible) {
            return;
        }
        renderables.pointLights.push(this);
    }
}
//# sourceMappingURL=light.js.map