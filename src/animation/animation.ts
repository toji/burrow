import { Vec4, Quat } from '../../third-party/gl-matrix/dist/src/index.js';
import { SceneObject } from '../scene/node.js';

const tmpOut0 = new Vec4(4);
const tmpOut1 = new Vec4(4);

export abstract class AnimationSampler {
  constructor(public times: number[], public values: any[], public componentCount: number) {
  }

  get duration() {
    return this.times[this.times.length - 1];
  }

  getTimeIndex(t: number) {
    // TODO: Optimize the crap out of this!
    if (t < this.times[0]) {
      return [0, 0, 0.0];
    }
    const last = this.times.length - 1;
    if (t >= this.times[last]) {
      return [last, last, 0.0];
    }
    let t0 = this.times[0];
    for (let i = 1; i < this.times.length; ++i) {
      const t1 = this.times[i];
      if (t <= t1) {
        const a = (t - t0) / (t1 - t0);
        return [i-1, i, a];
      }
      t0 = t1;
    }
  }

  getValueAt(out: any, index: number) {
    const offset = index * this.componentCount;
    switch(this.componentCount) {
      case 4:
        out[3] = this.values[offset+3];
      case 3:
        out[2] = this.values[offset+2];
      case 2:
        out[1] = this.values[offset+1];
      case 1:
        out[0] = this.values[offset];
    }
  }

  abstract sampleValue(out: any, t: number): void;
}

export class StepAnimationSampler extends AnimationSampler {
  sampleValue(out: any, t: number) {
    const ti = this.getTimeIndex(t);
    this.getValueAt(out, ti[0]);
  }
}

export class LinearAnimationSampler extends AnimationSampler {
  sampleValue(out: any, t: number) {
    const ti = this.getTimeIndex(t);
    this.getValueAt(tmpOut0, ti[0]);
    this.getValueAt(tmpOut1, ti[1]);

    // Get the weights for the two values
    const w1 = ti[2];
    const w0 = 1 - w1;

    switch(this.componentCount) {
      case 4:
        out[3] = tmpOut0[3] * w0 + tmpOut1[3] * w1;
      case 3:
        out[2] = tmpOut0[2] * w0 + tmpOut1[2] * w1;
      case 2:
        out[1] = tmpOut0[1] * w0 + tmpOut1[1] * w1;
      case 1:
        out[0] = tmpOut0[0] * w0 + tmpOut1[0] * w1;
    }
  }
}

export class SphericalLinearAnimationSampler extends AnimationSampler {
  sampleValue(out: any, t: number) {
    const ti = this.getTimeIndex(t);
    this.getValueAt(tmpOut0, ti[0]);
    this.getValueAt(tmpOut1, ti[1]);
    Quat.slerp(out, tmpOut0, tmpOut1, ti[2]);
  }
}

export class AnimationChannel {
  constructor(public targetIndex: number, public path: string, public sampler: AnimationSampler) {
  }

  applyAtTime(t: number, target: AnimationTarget) {
    const sceneObject = target.objects[this.targetIndex];
    const transform = sceneObject.transform.copy(); // TODO: NOT THIS!
    this.sampler.sampleValue(transform[this.path], t);
    sceneObject.transform = transform;
  }
}

export class AnimationTarget {
  constructor(public objects: SceneObject[]) {}
}

export class Animation {
  duration: number = 0;
  constructor(public name: string, public channels: AnimationChannel[]) {
    for (const channel of this.channels) {
      this.duration = Math.max(this.duration, channel.sampler.duration);
    }
  }

  applyAtTime(t: number, target: AnimationTarget) {
    // TODO: Better control over edge behavior
    t = (t / 1000) % this.duration;

    for (const channel of this.channels) {
      channel.applyAtTime(t, target);
    }
  }
}