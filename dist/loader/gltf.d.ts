import { WebGpuTextureLoader } from '../../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js';
import { DeferredRenderer, Scene } from '../renderer/deferred-renderer.js';
export declare class GltfLoader {
    #private;
    renderer: DeferredRenderer;
    constructor(renderer: DeferredRenderer);
    get textureLoader(): WebGpuTextureLoader;
    clearCache(): void;
    loadFromUrl(url: string): Promise<Scene>;
}
