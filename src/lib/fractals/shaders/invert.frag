#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hit;
uniform float u_drive;
uniform float u_bounce;
uniform float u_span;
uniform float u_scale;
uniform int u_fold;
uniform vec2 u_kick;
uniform vec2 u_home;
uniform int u_palette;
uniform float u_color_shift;
uniform float u_reveal;

const int STEPS = 24;

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

vec2 keepOffset(vec2 offset) {
  offset.y = max(abs(offset.y), 0.12) * (offset.y < 0.0 ? -1.0 : 1.0);
  float olen = length(offset);
  return offset * (clamp(olen, 0.50, 0.88) / max(olen, 1e-5));
}

void main() {
  float span = clamp(u_span, 5.5, 12.0);
  float size = max(0.02, 1.0 + u_bounce);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  uv *= span / size;

  float ang = u_time * 0.08 + atan(u_kick.y, u_kick.x) * 0.85;
  float ca = cos(ang);
  float sa = sin(ang);
  uv = mat2(ca, -sa, sa, ca) * uv;

  float scale = clamp(u_scale + (u_drive - 0.75) * 0.05, 1.28, 1.50);
  vec2 offset = keepOffset(u_home + u_kick * 0.35);
  vec2 p = uv;
  float minRing = 1e5;
  float trap = 0.0;

  for (int i = 0; i < STEPS; i++) {
    p = abs(p);
    if (u_fold >= 8 && p.x < p.y) p = p.yx;
    p = p * scale / max(dot(p, p), 1e-8);
    p -= offset;
    minRing = min(minRing, abs(length(p) - 1.0));
    trap += 1.0 / (1.0 + dot(p, p));
  }

  float px = span / min(u_resolution.x, u_resolution.y);
  float w = px * 1.25;
  float core = smoothstep(w * 2.6, 0.0, minRing);
  float glow = exp(-minRing / (px * 7.0)) * 0.32;
  float energy = clamp(0.95 + u_hit * 0.35 + u_drive * 0.15, 0.0, 1.45);
  float line = (core + glow) * energy * smoothstep(0.03, 0.18, size);

  vec3 pal = palette(trap * 0.08 * u_color_shift + u_time * 0.08);
  fragColor = vec4(pal * line, 1.0);

  float r = clamp(u_reveal, 0.0, 1.0);
  float exposure = mix(0.62, 1.0, smoothstep(0.1, 0.7, r));
  float radius = mix(0.9, 2.4, pow(r, 0.55));
  float aperture = 1.0 - smoothstep(radius * 0.55, radius, length(uv * size / span));
  aperture = max(mix(aperture, 1.0, smoothstep(0.85, 1.0, r)), 0.38);
  fragColor.rgb *= exposure * aperture;
}
