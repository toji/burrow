import { Vec3Like, Vec4Like } from "../../node_modules/gl-matrix/dist/esm/index.js";

export interface PbrMaterialDescriptor {
  label?: string;

  sampler?: GPUSampler;
  baseColorFactor?: Vec4Like;
  baseColorTexture?: GPUTexture;
  normalTexture?: GPUTexture;
  metallicFactor?: number;
  roughnessFactor?: number;
  metallicRoughnessTexture?: GPUTexture;
  emissiveFactor?: Vec3Like;
  emissiveTexture?: GPUTexture;
  occlusionTexture?: GPUTexture;
  occlusionStrength?: number;

  transparent?: boolean;
  doubleSided?: boolean;
  alphaCutoff?: number;
  unlit?: boolean;
}

export class RenderMaterial {
  constructor(
    public bindGroup: GPUBindGroup,
    public transparent: boolean,
    public doubleSided: boolean,
    public discard: boolean,
    public unlit: boolean,
  ) {}

  get key(): number {
    return (this.transparent ? 0x01 : 0) +
      (this.doubleSided ? 0x02 : 0) +
      (this.discard ? 0x04 : 0) +
      (this.unlit ? 0x08 : 0);
  }
}