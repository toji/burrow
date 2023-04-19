const MAX_POINT_LIGHTS = 64;
const DIRECTIONAL_LIGHT_STRUCT_SIZE = 32;
const POINT_LIGHT_STRUCT_SIZE = 32;
const LIGHT_BUFFER_SIZE = DIRECTIONAL_LIGHT_STRUCT_SIZE + (MAX_POINT_LIGHTS * POINT_LIGHT_STRUCT_SIZE) + 16;
const DEFAULT_DIR = new Float32Array([0, -1, 0]);
const DEFAULT_COLOR = new Float32Array([1, 1, 1]);
export class RenderLightManager {
    device;
    lightBuffer;
    lightArrayBuffer;
    pointLightCount = 6;
    directionalIntensity = 0;
    environment; // IBL Map
    defaultEnvironment;
    environmentSampler;
    constructor(device) {
        this.device = device;
        this.lightArrayBuffer = new ArrayBuffer(LIGHT_BUFFER_SIZE);
        this.lightBuffer = device.createBuffer({
            label: 'light storage buffer',
            size: LIGHT_BUFFER_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.environmentSampler = device.createSampler({
            label: 'environment sampler',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            addressModeW: 'repeat',
        });
        // A simple 1x1 black environment map
        this.defaultEnvironment = device.createTexture({
            label: 'default environment map',
            size: [1, 1, 6],
            usage: GPUTextureUsage.TEXTURE_BINDING,
            format: 'rg11b10ufloat',
        });
    }
    updateLights(renderables) {
        const dirLightArray = new Float32Array(this.lightArrayBuffer, 0, 8);
        dirLightArray.set(renderables.directionalLight?.direction || DEFAULT_DIR);
        dirLightArray.set(renderables.directionalLight?.color || DEFAULT_COLOR, 4);
        dirLightArray[7] = renderables.directionalLight?.intensity || 0;
        this.directionalIntensity = dirLightArray[7];
        // TODO: This shouldn't have to be updated every frame, but whatever.
        this.pointLightCount = Math.min(renderables.pointLights.length || 0, MAX_POINT_LIGHTS);
        const pointLightCount = new Uint32Array(this.lightArrayBuffer, DIRECTIONAL_LIGHT_STRUCT_SIZE, 1);
        pointLightCount[0] = this.pointLightCount;
        for (let i = 0; i < this.pointLightCount; ++i) {
            const sceneLight = renderables.pointLights[i];
            const lightOffset = DIRECTIONAL_LIGHT_STRUCT_SIZE + 16 + (i * POINT_LIGHT_STRUCT_SIZE);
            // TODO: These arrays could be cached.
            const pointLightArray = new Float32Array(this.lightArrayBuffer, lightOffset, 8);
            pointLightArray.set(sceneLight.worldPosition);
            pointLightArray[3] = sceneLight.range || 0;
            pointLightArray.set(sceneLight.color || DEFAULT_COLOR, 4);
            pointLightArray[7] = sceneLight.intensity;
        }
        this.device.queue.writeBuffer(this.lightBuffer, 0, this.lightArrayBuffer);
    }
}
//# sourceMappingURL=render-light.js.map