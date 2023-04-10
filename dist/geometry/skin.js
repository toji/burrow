export class RenderSkin {
    renderer;
    bindGroup;
    joints;
    invBindBuffer;
    jointBuffer;
    #jointArray;
    constructor(renderer, bindGroup, joints, invBindBuffer, jointBuffer) {
        this.renderer = renderer;
        this.bindGroup = bindGroup;
        this.joints = joints;
        this.invBindBuffer = invBindBuffer;
        this.jointBuffer = jointBuffer;
        this.#jointArray = new Float32Array(joints.length * 16);
    }
    updateJoints(animationTarget) {
        for (const [index, joint] of this.joints.entries()) {
            this.#jointArray.set(animationTarget.objects[joint].worldMatrix, index * 16);
        }
        this.renderer.device.queue.writeBuffer(this.jointBuffer, 0, this.#jointArray);
    }
    clone() {
        return this.renderer.cloneSkin(this);
    }
}
//# sourceMappingURL=skin.js.map