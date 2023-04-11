import { DeferredRenderer } from '../renderer/deferred-renderer.js';
import { SceneObject } from '../scene/object.js';
import { Animation } from '../animation/animation.js';
import { WebGpuTextureLoader } from '../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js';
export interface GltfResult {
    scene: SceneObject;
    animations: Animation[];
}
export declare class GltfLoader {
    #private;
    renderer: DeferredRenderer;
    constructor(renderer: DeferredRenderer);
    get textureLoader(): WebGpuTextureLoader;
    clearCache(): void;
    loadFromUrl(url: string): Promise<GltfResult>;
}