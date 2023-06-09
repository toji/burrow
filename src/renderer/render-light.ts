import { Renderables } from './deferred-renderer.js';

const MAX_POINT_LIGHTS = 64;
const DIRECTIONAL_LIGHT_STRUCT_SIZE = 32;
const POINT_LIGHT_STRUCT_SIZE = 32;
const LIGHT_BUFFER_SIZE = DIRECTIONAL_LIGHT_STRUCT_SIZE + (MAX_POINT_LIGHTS * POINT_LIGHT_STRUCT_SIZE) + 16;

const DEFAULT_DIR = new Float32Array([0, -1, 0]);
const DEFAULT_COLOR = new Float32Array([1, 1, 1]);
const DEFAULT_AMBIENT = new Float32Array([0, 0, 0]);

export class RenderLightManager {
  lightBuffer: GPUBuffer;
  lightArrayBuffer: ArrayBuffer;

  pointLightCount: number = 6;
  directionalIntensity: number = 0;

  environment: GPUTexture; // IBL Map
  defaultEnvironment: GPUTexture;
  environmentSampler: GPUSampler;

  constructor(public device: GPUDevice) {
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

  updateLights(renderables: Renderables) {
    const ambientArray = new Float32Array(this.lightArrayBuffer, 0, 3);
    ambientArray.set(renderables.ambientLight || DEFAULT_AMBIENT);

    const dirLightArray = new Float32Array(this.lightArrayBuffer, 16, 8);
    dirLightArray.set(renderables.directionalLight?.direction || DEFAULT_DIR);
    dirLightArray.set(renderables.directionalLight?.color || DEFAULT_COLOR, 4);
    dirLightArray[7] = renderables.directionalLight?.intensity || 0;
    this.directionalIntensity = dirLightArray[7];

    // TODO: This shouldn't have to be updated every frame, but whatever.
    this.pointLightCount = Math.min(renderables.pointLights.length || 0, MAX_POINT_LIGHTS);

    const pointLightCount = new Uint32Array(this.lightArrayBuffer, DIRECTIONAL_LIGHT_STRUCT_SIZE + 16, 1);
    pointLightCount[0] = this.pointLightCount;

    for (let i = 0; i < this.pointLightCount; ++i) {
      const sceneLight = renderables.pointLights[i];
      const lightOffset = DIRECTIONAL_LIGHT_STRUCT_SIZE + 32 + (i * POINT_LIGHT_STRUCT_SIZE);

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