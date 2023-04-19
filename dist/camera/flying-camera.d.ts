import { Mat4, Vec3 } from '../../node_modules/gl-matrix/dist/esm/index.js';
export declare class FlyingCamera {
    #private;
    speed: number;
    constructor(element?: HTMLElement);
    set element(value: HTMLElement);
    get element(): HTMLElement;
    rotateView(xDelta: number, yDelta: number): void;
    set position(value: Readonly<Vec3>);
    get position(): Readonly<Vec3>;
    get viewMatrix(): Readonly<Mat4>;
    update(frameTime: number): void;
}
