import { GeometryLayout } from './geometry-layout.js';

export enum AttributeLocation {
  position = 0,
  normal =  1,
  tangent = 2,
  texcoord = 3,
  texcoord2 = 4,
  color = 5,
  joints = 6,
  weights = 7,
};

export type TypedArray =
  Float32Array | Float64Array |
  Uint32Array | Int32Array |
  Uint16Array | Int16Array |
  Uint8Array | Int8Array;

export type GeometryValues = GPUBuffer | TypedArray | ArrayBuffer | number[];

export interface AttributeDescriptor {
  values: GeometryValues;
  offset?: number;
  stride?: number;
  format?: GPUVertexFormat;
};

export type GeometryAttribute = GeometryValues | AttributeDescriptor;

export type GeometryIndexValues = GPUBuffer | Uint16Array | Uint32Array | ArrayBuffer | number[];

export interface GeometryIndexDescriptor {
  values: GeometryIndexValues;
  offset?: number;
  format?: GPUIndexFormat; // Required if indices is a GPUBuffer, optional if indices are a number array, ignored otherwise.
};

export type GeometryIndices = GeometryIndexValues | GeometryIndexDescriptor;

export interface GeometryDescriptor {
  label?: string;

  position: GeometryAttribute,
  normal?: GeometryAttribute,
  tangent?: GeometryAttribute,
  texcoord?: GeometryAttribute,
  texcoord2?: GeometryAttribute,
  color?: GeometryAttribute,
  joints?: GeometryAttribute,
  weights?: GeometryAttribute,

  indices?: GeometryIndices;

  drawCount?: number;
  topology?: GPUPrimitiveTopology;
};

export interface VertexBufferBinding {
  slot: number,
  buffer: GPUBuffer;
  offset: number;
};

export interface IndexBufferBinding {
  buffer: GPUBuffer;
  offset: number;
  indexFormat: GPUIndexFormat;
};

export class RenderGeometry {
  constructor(
    public drawCount: number,
    public vertexBuffers: VertexBufferBinding[],
    public layout: Readonly<GeometryLayout>,
    public indexBuffer?: IndexBufferBinding,
  ) {}
};
