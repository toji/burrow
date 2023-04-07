import { Mat4 } from "../../third-party/gl-matrix/dist/src/index.js";
import { SceneObject } from "../scene/node.js";

export interface SkinDescriptor {
  inverseBindMatrices: Mat4[] | Float32Array;
  joints: SceneObject[];
}

export class RenderSkin {
  #jointArray: Float32Array;
  constructor(
    public device: GPUDevice,
    public bindGroup: GPUBindGroup,
    public joints: SceneObject[],
    public jointBuffer: GPUBuffer,
  ) {
    this.#jointArray = new Float32Array(joints.length * 16);
  }

  updateJoints() {
    for (const [index, joint] of this.joints.entries()) {
      this.#jointArray.set(joint.worldMatrix, index * 16);
    }
    this.device.queue.writeBuffer(this.jointBuffer, 0, this.#jointArray);
  }
}