export class RenderMaterial {
    bindGroup;
    transparent;
    doubleSided;
    discard;
    constructor(bindGroup, transparent, doubleSided, discard) {
        this.bindGroup = bindGroup;
        this.transparent = transparent;
        this.doubleSided = doubleSided;
        this.discard = discard;
    }
    get key() {
        return;
        (this.transparent ? 0x01 : 0) +
            (this.doubleSided ? 0x02 : 0) +
            (this.discard ? 0x04 : 0);
    }
}
//# sourceMappingURL=material.js.map