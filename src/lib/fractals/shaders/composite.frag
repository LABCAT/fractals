#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_fractal;
uniform sampler2D u_history;
uniform vec2 u_resolution;
uniform float u_trail;
uniform float u_aberration;
uniform float u_glow;

void main() {
  vec2 uv = v_uv;
  vec2 c = uv - 0.5;
  float r = length(c);
  vec2 ca = c * u_aberration * r * r;

  vec3 fracCol = vec3(
    texture(u_fractal, uv - ca).r,
    texture(u_fractal, uv).g,
    texture(u_fractal, uv + ca).b
  );
  vec3 hist = texture(u_history, uv).rgb;
  vec3 col = mix(fracCol, hist, u_trail * 0.55) + hist * u_trail * 0.25;
  col += fracCol * u_glow;

  float vig = smoothstep(1.15, 0.45, r);
  col *= vig;

  fragColor = vec4(col, 1.0);
}
