import { cameraStruct, lightStruct } from "./shaders/deferred.js";

const lightSpriteShader = /*wgsl*/`
  ${cameraStruct}
  @group(0) @binding(0) var<uniform> camera : Camera;

  ${lightStruct}
  @group(0) @binding(1) var<storage> lights : Lights;

  const pos : array<vec2f, 4> = array<vec2f, 4>(
    vec2f(-1, 1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, -1)
  );

  struct VertexInput {
    @builtin(vertex_index) vertex : u32,
    @builtin(instance_index) instance : u32,
  };

  struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) localPos : vec2f,
    @location(1) color: vec3f,
  };

  @vertex
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    let light = &lights.pointLights[input.instance];

    output.localPos = pos[input.vertex];
    output.color = (*light).color * (*light).intensity;
    let worldPos = vec3f(output.localPos, 0) * (*light).range * 0.025;

    // Generate a billboarded model view matrix
    var bbModelViewMatrix : mat4x4<f32>;
    bbModelViewMatrix[3] = vec4((*light).position, 1.0);
    bbModelViewMatrix = camera.view * bbModelViewMatrix;
    bbModelViewMatrix[0][0] = 1.0;
    bbModelViewMatrix[0][1] = 0.0;
    bbModelViewMatrix[0][2] = 0.0;

    bbModelViewMatrix[1][0] = 0.0;
    bbModelViewMatrix[1][1] = 1.0;
    bbModelViewMatrix[1][2] = 0.0;

    bbModelViewMatrix[2][0] = 0.0;
    bbModelViewMatrix[2][1] = 0.0;
    bbModelViewMatrix[2][2] = 1.0;

    output.position = camera.projection * bbModelViewMatrix * vec4f(worldPos, 1.0);
    return output;
  }

  @fragment
  fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
    let distToCenter = length(input.localPos);
    let fade = (1.0 - distToCenter) * (1.0 / (distToCenter * distToCenter));
    return vec4f(input.color * fade, fade);
  }
`;

export class LightSpriteRenderer {
  pipeline: GPURenderPipeline;

  constructor(public device: GPUDevice, frameBindGroupLayout: GPUBindGroupLayout) {
    const shaderModule = device.createShaderModule({
      label: 'light sprite shader',
      code: lightSpriteShader,
    });

    const fragmentTargets: GPUColorTargetState[] = [{
      format: 'rgb10a2unorm', // TODO: Pull from a central location
      blend: {
        color: {
          srcFactor: 'src-alpha',
          dstFactor: 'one',
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: 'one',
        },
      },
    }];

    // Setup a render pipeline for drawing the light sprites
    this.pipeline = device.createRenderPipeline({
      label: `light sprite pipeline`,
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          frameBindGroupLayout,
        ]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: fragmentTargets,
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32'
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less',
        format: 'depth16unorm',
      }
    });
  }

  render(renderPass: GPURenderPassEncoder, lightCount: number) {
    renderPass.setPipeline(this.pipeline);
    renderPass.draw(4, lightCount);
  }
}
