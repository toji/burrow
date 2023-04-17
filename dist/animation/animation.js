import { Vec4, Quat } from '../../node_modules/gl-matrix/dist/esm/index.js';
const tmpOut0 = new Vec4(4);
const tmpOut1 = new Vec4(4);
export class AnimationSampler {
    times;
    values;
    componentCount;
    constructor(times, values, componentCount) {
        this.times = times;
        this.values = values;
        this.componentCount = componentCount;
    }
    get duration() {
        return this.times[this.times.length - 1];
    }
    getTimeIndex(t) {
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
                return [i - 1, i, a];
            }
            t0 = t1;
        }
    }
    getValueAt(out, index) {
        const offset = index * this.componentCount;
        switch (this.componentCount) {
            case 4:
                out[3] = this.values[offset + 3];
            case 3:
                out[2] = this.values[offset + 2];
            case 2:
                out[1] = this.values[offset + 1];
            case 1:
                out[0] = this.values[offset];
        }
    }
}
export class StepAnimationSampler extends AnimationSampler {
    sampleValue(out, t) {
        const ti = this.getTimeIndex(t);
        this.getValueAt(out, ti[0]);
    }
}
export class LinearAnimationSampler extends AnimationSampler {
    sampleValue(out, t) {
        const ti = this.getTimeIndex(t);
        this.getValueAt(tmpOut0, ti[0]);
        this.getValueAt(tmpOut1, ti[1]);
        // Get the weights for the two values
        const w1 = ti[2];
        const w0 = 1 - w1;
        switch (this.componentCount) {
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
    sampleValue(out, t) {
        const ti = this.getTimeIndex(t);
        this.getValueAt(tmpOut0, ti[0]);
        this.getValueAt(tmpOut1, ti[1]);
        Quat.slerp(out, tmpOut0, tmpOut1, ti[2]);
    }
}
export class AnimationChannel {
    targetIndex;
    path;
    sampler;
    constructor(targetIndex, path, sampler) {
        this.targetIndex = targetIndex;
        this.path = path;
        this.sampler = sampler;
    }
    applyAtTime(t, target) {
        const sceneObject = target.objects[this.targetIndex];
        this.sampler.sampleValue(sceneObject.transform[this.path], t);
    }
}
export class AnimationTarget {
    objects;
    constructor(objects) {
        this.objects = objects;
    }
}
export class Animation {
    name;
    channels;
    duration = 0;
    constructor(name, channels) {
        this.name = name;
        this.channels = channels;
        for (const channel of this.channels) {
            this.duration = Math.max(this.duration, channel.sampler.duration);
        }
    }
    applyAtTime(t, target) {
        // TODO: Better control over edge behavior
        t = (t / 1000) % this.duration;
        for (const channel of this.channels) {
            channel.applyAtTime(t, target);
        }
    }
}
//# sourceMappingURL=animation.js.map