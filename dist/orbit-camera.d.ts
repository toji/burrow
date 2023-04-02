import { Mat4, Vec3, Vec3Like } from '../third-party/gl-matrix/dist/src/index.js';
export declare class OrbitCamera {
    #private;
    orbitX: number;
    orbitY: number;
    maxOrbitX: number;
    minOrbitX: number;
    maxOrbitY: number;
    minOrbitY: number;
    constrainXOrbit: boolean;
    constrainYOrbit: boolean;
    maxDistance: number;
    minDistance: number;
    distanceStep: number;
    constrainDistance: boolean;
    constructor(element?: any);
    set element(value: HTMLElement);
    get element(): HTMLElement;
    orbit(xDelta: number, yDelta: number): void;
    get target(): Vec3Like;
    set target(value: Vec3Like);
    get distance(): number;
    set distance(value: number);
    get position(): Vec3;
    get viewMatrix(): Mat4;
}
