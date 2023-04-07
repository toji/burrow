export class RenderMaterial {
    bindGroup;
    transparent;
    doubleSided;
    discard;
    unlit;
    constructor(bindGroup, transparent, doubleSided, discard, unlit) {
        this.bindGroup = bindGroup;
        this.transparent = transparent;
        this.doubleSided = doubleSided;
        this.discard = discard;
        this.unlit = unlit;
    }
    get key() {
        return (this.transparent ? 0x01 : 0) +
            (this.doubleSided ? 0x02 : 0) +
            (this.discard ? 0x04 : 0) +
            (this.unlit ? 0x08 : 0);
    }
}
//# sourceMappingURL=material.js.map