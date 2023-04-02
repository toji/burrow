import { GltfTransform } from './gltf-transform.js';
import { SetDefaults } from './set-defaults.js';
import { vec3, mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';
// Very simple AABB tracking so that we can position cameras sensibly.
export class AABB {
    min = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    max = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
    constructor(aabb) {
        if (aabb) {
            vec3.copy(this.min, aabb.min);
            vec3.copy(this.max, aabb.max);
        }
    }
    union(other) {
        vec3.min(this.min, this.min, other.min);
        vec3.max(this.max, this.max, other.max);
    }
    transform(mat) {
        const corners = [
            [this.min[0], this.min[1], this.min[2]],
            [this.min[0], this.min[1], this.max[2]],
            [this.min[0], this.max[1], this.min[2]],
            [this.min[0], this.max[1], this.max[2]],
            [this.max[0], this.min[1], this.min[2]],
            [this.max[0], this.min[1], this.max[2]],
            [this.max[0], this.max[1], this.min[2]],
            [this.max[0], this.max[1], this.max[2]],
        ];
        vec3.set(this.min, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        vec3.set(this.max, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
        for (const corner of corners) {
            vec3.transformMat4(corner, corner, mat);
            vec3.min(this.min, this.min, corner);
            vec3.max(this.max, this.max, corner);
        }
    }
    get center() {
        return vec3.fromValues(((this.max[0] + this.min[0]) * 0.5), ((this.max[1] + this.min[1]) * 0.5), ((this.max[2] + this.min[2]) * 0.5));
    }
    get radius() {
        return vec3.distance(this.max, this.min) * 0.5;
    }
}
// Resolves every buffer in the glTF file into an arrayBuffer.
export class ComputeAABB extends GltfTransform {
    static preCache = false;
    static Dependencies = [SetDefaults];
    transform(gltf, buffers, images, options) {
        const setWorldMatrix = (node, parentWorldMatrix) => {
            // Don't recompute nodes we've already visited.
            if (node.extras?.worldMatrix) {
                return;
            }
            let worldMatrix;
            if (node.matrix) {
                worldMatrix = mat4.clone(node.matrix);
            }
            else {
                worldMatrix = mat4.create();
                mat4.fromRotationTranslationScale(worldMatrix, node.rotation, node.translation, node.scale);
            }
            mat4.multiply(worldMatrix, parentWorldMatrix, worldMatrix);
            this.setExtras(node, { worldMatrix });
            // If the node has a mesh, get the AABB for that mesh and transform it to get the node's AABB.
            if ('mesh' in node) {
                const mesh = gltf.meshes[node.mesh];
                // Compute the mesh AABB if we haven't previously.
                if (!mesh.extras?.aabb) {
                    this.setExtras(mesh, { aabb: new AABB() });
                    for (const primitive of mesh.primitives) {
                        // The accessor has a min and max property
                        mesh.extras.aabb.union(gltf.accessors[primitive.attributes.POSITION]);
                    }
                }
                this.setExtras(node, { aabb: new AABB(mesh.extras.aabb) });
                node.extras.aabb.transform(worldMatrix);
            }
            if (node.children) {
                for (const childIndex of node.children) {
                    const child = gltf.nodes[childIndex];
                    setWorldMatrix(child, worldMatrix);
                    if (child.extras?.aabb) {
                        if (!node.extras?.aabb) {
                            this.setExtras(node, { aabb: new AABB(child.extras.aabb) });
                        }
                        else {
                            node.extras.aabb.union(child.extras.aabb);
                        }
                    }
                }
            }
        };
        for (const scene of Object.values(gltf.scenes)) {
            for (const nodeIndex of scene.nodes) {
                const node = gltf.nodes[nodeIndex];
                setWorldMatrix(node, mat4.create());
                if (node.extras?.aabb && options.computeSceneAABB !== false) {
                    if (!scene.extras?.aabb) {
                        this.setExtras(scene, { aabb: new AABB(node.extras.aabb) });
                    }
                    else {
                        scene.extras.aabb.union(node.extras.aabb);
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=compute-aabb.js.map