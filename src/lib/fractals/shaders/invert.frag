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
uniform float u_reveal;

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

  float scale = mix(1.25, 1.55, u_drive);
  vec2 offset = u_home + u_kick * 0.55;
  vec2 p = uv;

  float minRing = 1e5;
  float trap = 0.0;
  // Keep enough folds at low energy so sparse hits still show structure
  int steps = 14 + int(u_drive * 10.0 + u_hit * 6.0);

  for (int i = 0; i < 28; i++) {
    if (i >= steps) break;
    p = abs(p);
    if (p.x < p.y) p = p.yx;
    p = invert(p, scale);
    p -= offset;
    minRing = min(minRing, abs(length(p) - 1.0));
    trap += 1.0 / (1.0 + dot(p, p));
  }

  float foam = pow(smoothstep(0.11, 0.0, minRing), 0.55);
  float fine = pow(smoothstep(0.035, 0.0, minRing), 1.35);
  float ring = smoothstep(0.06, 0.0, abs(length(uv) - 2.15));
  float energy = clamp(u_drive + u_hit, 0.0, 1.4);
  // Don't collapse to a faint ring when foam is sparse
  float line = mix(max(ring * 0.75, foam * 0.65), max(ring * 0.25, foam), clamp(energy, 0.0, 1.0));
  line = max(line, fine * 0.9);
  line = max(line, smoothstep(0.0, 1.8, trap) * 0.18 * (0.5 + energy));
  line *= 0.8 + u_hit * 0.7 + u_drive * 0.4;

  vec3 pal = palette(trap * 0.08 * u_color_shift + u_time * 0.08);
  fragColor = vec4(pal * line, 1.0);

  float r = clamp(u_reveal, 0.0, 1.0);
  float exposure = smoothstep(0.0, 0.65, r);
  float radius = mix(0.08, 2.2, pow(r, 0.55));
  float aperture = 1.0 - smoothstep(radius * 0.5, radius, length(uv / 6.5));
  aperture = mix(aperture, 1.0, smoothstep(0.85, 1.0, r));
  fragColor.rgb *= exposure * aperture;
}
