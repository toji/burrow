const fqVertexState = new WeakMap();
export function FullscreenQuadVertexState(device) {
    let state = fqVertexState.get(device);
    if (!state) {
        const module = device.createShaderModule({
            label: 'Fullscreen Quad Vertex Shader Module',
            code: /* wgsl */ `
        const pos = array<vec2f, 3>(
          vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));

        struct VertexOut {
          @builtin(position) pos: vec4f,
          @location(0) texcoord: vec2f,
        };

        @vertex
        fn vertexMain(@builtin(vertex_index) i: u32) -> VertexOut {
          let p = pos[i];
          var out: VertexOut;
          out.pos = vec4f(p, 0, 1);
          out.texcoord = vec2f(p.x, -p.y) * 0.5 + 0.5;
          return out;
        }
      `
        });
        state = {
            module,
            entryPoint: 'vertexMain',
        };
        fqVertexState.set(device, state);
    }
    return state;
}
//# sourceMappingURL=fullscreen-quad.js.map