export class GltfTransform {
    static Dependencies = [];
    static preCache = true;
    constructor(loaderOptions) { }
    setExtras(obj, extras) {
        if (obj.extras === undefined) {
            obj.extras = extras;
        }
        else {
            Object.assign(obj.extras, extras);
        }
    }
}
//# sourceMappingURL=gltf-transform.js.map