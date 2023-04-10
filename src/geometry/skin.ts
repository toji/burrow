import { Mat4 } from "../../third-party/gl-matrix/dist/src/index.js";
import { AnimationTarget } from "../animation/animation.js";
import { RendererBase } from "../renderer/renderer-base.js";

export interface SkinDescriptor {
  inverseBindMatrices: Mat4[] | Float32Array;
  joints: number[];
}

export class RenderSkin {
  #jointArray: Float32Array;
  constructor(
    public renderer: RendererBase,
    public bindGroup: GPUBindGroup,
    public joints: number[],
    public invBindBuffer: GPUBuffer,
    public jointBuffer: GPUBuffer,
  ) {
    this.#jointArray = new Float32Array(joints.length * 16);
  }

  updateJoints(animationTarget: AnimationTarget) {
    for (const [index, joint] of this.joints.entries()) {
      this.#jointArray.set(animationTarget.objects[joint].worldMatrix, index * 16);
    }
    this.renderer.device.queue.writeBuffer(this.jointBuffer, 0, this.#jointArray);
  }

  clone(): RenderSkin {
    return this.renderer.cloneSkin(this);
  }
}