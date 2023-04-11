import { SceneObject } from '../scene/object.js';
export declare abstract class AnimationSampler {
    times: number[];
    values: any[];
    componentCount: number;
    constructor(times: number[], values: any[], componentCount: number);
    get duration(): number;
    getTimeIndex(t: number): number[];
    getValueAt(out: any, index: number): void;
    abstract sampleValue(out: any, t: number): void;
}
export declare class StepAnimationSampler extends AnimationSampler {
    sampleValue(out: any, t: number): void;
}
export declare class LinearAnimationSampler extends AnimationSampler {
    sampleValue(out: any, t: number): void;
}
export declare class SphericalLinearAnimationSampler extends AnimationSampler {
    sampleValue(out: any, t: number): void;
}
export declare class AnimationChannel {
    targetIndex: number;
    path: string;
    sampler: AnimationSampler;
    constructor(targetIndex: number, path: string, sampler: AnimationSampler);
    applyAtTime(t: number, target: AnimationTarget): void;
}
export declare class AnimationTarget {
    objects: SceneObject[];
    constructor(objects: SceneObject[]);
}
export declare class Animation {
    name: string;
    channels: AnimationChannel[];
    duration: number;
    constructor(name: string, channels: AnimationChannel[]);
    applyAtTime(t: number, target: AnimationTarget): void;
}
