export class ResolveSparseAccessors extends GltfTransform {
    static Dependencies: (typeof SetDefaults)[];
    transform(gltf: any, buffers: any, images: any): void;
}
import { GltfTransform } from "./gltf-transform.js";
import { SetDefaults } from "./set-defaults.js";
