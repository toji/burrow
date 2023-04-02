export class AABB {
    constructor(aabb: any);
    min: any;
    max: any;
    union(other: any): void;
    transform(mat: any): void;
    get center(): any;
    get radius(): number;
}
export class ComputeAABB extends GltfTransform {
    static Dependencies: (typeof SetDefaults)[];
    transform(gltf: any, buffers: any, images: any, options: any): void;
}
import { GltfTransform } from "./gltf-transform.js";
import { SetDefaults } from "./set-defaults.js";
