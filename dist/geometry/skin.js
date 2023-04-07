export class RenderSkin {
    device;
    bindGroup;
    joints;
    jointBuffer;
    #jointArray;
    constructor(device, bindGroup, joints, jointBuffer) {
        this.device = device;
        this.bindGroup = bindGroup;
        this.joints = joints;
        this.jointBuffer = jointBuffer;
        this.#jointArray = new Float32Array(joints.length * 16);
    }
    updateJoints() {
        for (const [index, joint] of this.joints.entries()) {
            this.#jointArray.set(joint.worldMatrix, index * 16);
        }
        this.device.queue.writeBuffer(this.jointBuffer, 0, this.#jointArray);
    }
}
//# sourceMappingURL=skin.js.map