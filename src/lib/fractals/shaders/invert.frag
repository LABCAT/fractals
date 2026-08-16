#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hit;
uniform float u_drive;
uniform vec2 u_kick;
uniform vec2 u_home;
uniform int u_palette;
uniform float u_color_shift;

vec3 palette(float t) {
  t = fract(t);
  if (u_palette == 0) return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.00, 0.33, 0.67)));
  if (u_palette == 1) return vec3(0.5, 0.2, 0.4) + vec3(0.5, 0.4, 0.4) * cos(6.28318 * (t + vec3(0.70, 0.15, 0.00)));
  if (u_palette == 2) return vec3(0.4, 0.2, 0.5) + vec3(0.6, 0.8, 0.5) * cos(6.28318 * (vec3(1.0, 2.0, 1.0) * t + vec3(0.30, 0.90, 0.10)));
  if (u_palette == 3) return vec3(0.5, 0.0, 0.5) + 0.5 * cos(6.28318 * (vec3(2.0, 1.0, 0.0) * t + vec3(0.50, 0.20, 0.25)));
  if (u_palette == 4) return vec3(0.1, 0.5, 0.4) + vec3(0.2, 0.4, 0.3) * cos(6.28318 * (t + vec3(0.00, 0.20, 0.40)));
  if (u_palette == 5) return vec3(smoothstep(0.0, 0.35, t), smoothstep(0.15, 0.65, t), smoothstep(0.5, 1.0, t));
  if (u_palette == 6) return vec3(0.4, 0.35, 0.12) + vec3(0.55, 0.45, 0.2) * cos(6.28318 * (t + vec3(0.0, 0.1, 0.2)));
  return vec3(0.08, 0.15, 0.45) + vec3(0.35, 0.45, 0.55) * cos(6.28318 * (t + vec3(0.55, 0.75, 0.95)));
}

vec2 invert(vec2 p, float r2) {
  return p * r2 / max(dot(p, p), 1e-5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  uv *= 6.5;
  float ang = u_time * 0.1 + u_kick.x * 0.35;
  float c = cos(ang);
  float s = sin(ang);
  uv = mat2(c, -s, s, c) * uv;

  float scale = mix(1.2, 1.55, u_drive);
  vec2 offset = u_home + u_kick * 0.55;
  vec2 p = uv;

  float minRing = 1e5;
  float trap = 0.0;
  int steps = 8 + int(u_drive * 16.0 + u_hit * 8.0);

  for (int i = 0; i < 28; i++) {
    if (i >= steps) break;
    p = abs(p);
    if (p.x < p.y) p = p.yx;
    p = invert(p, scale);
    p -= offset;
    minRing = min(minRing, abs(length(p) - 1.0));
    trap += 1.0 / (1.0 + dot(p, p));
  }

  float foam = pow(smoothstep(0.12, 0.0, minRing), 0.65);
  float ring = smoothstep(0.08, 0.0, abs(length(uv) - 2.15));
  float line = mix(ring * 0.45, max(ring * 0.2, foam), u_drive + u_hit);
  line *= 0.55 + u_hit * 0.9 + u_drive * 0.5;

  vec3 pal = palette(trap * 0.08 * u_color_shift + u_time * 0.08);
  fragColor = vec4(pal * line, 1.0);
}
