#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_zoom;
uniform int u_max_iterations;
uniform int u_mode;
uniform float u_time;
uniform float u_color_shift;
uniform int u_palette;
uniform vec2 u_c;
uniform float u_power;
uniform float u_newton_power;
uniform float u_relaxation;
uniform float u_reveal;

vec2 cpow(vec2 z, float p) {
  float r = length(z);
  if (r < 1e-8) return vec2(0.0);
  float a = atan(z.y, z.x);
  return pow(r, p) * vec2(cos(p * a), sin(p * a));
}

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

vec4 shade(float n, vec2 z) {
  if (n < 0.0) return vec4(0.02, 0.02, 0.04, 1.0);
  float logzn = log(max(dot(z, z), 1e-8)) * 0.5;
  float nu = log(max(logzn / log(2.0), 1e-6)) / log(2.0);
  float t = (n + 1.0 - nu) * 0.02 * u_color_shift + u_time * 0.08;
  return vec4(palette(t), 1.0);
}

vec4 mandelbrot(vec2 c) {
  vec2 z = vec2(0.0);
  float n = -1.0;
  float maxIt = float(u_max_iterations);
  for (int i = 0; i < 256; i++) {
    if (float(i) >= maxIt) break;
    if (dot(z, z) > 16.0) { n = float(i); break; }
    if (u_power == 2.0) z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    else z = cpow(z, u_power) + c;
  }
  return shade(n, z);
}

vec4 julia(vec2 z) {
  vec2 c = u_c;
  float n = -1.0;
  float maxIt = float(u_max_iterations);
  for (int i = 0; i < 256; i++) {
    if (float(i) >= maxIt) break;
    if (dot(z, z) > 16.0) { n = float(i); break; }
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
  }
  return shade(n, z);
}

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cpow_int(vec2 z, int n) {
  vec2 r = vec2(1.0, 0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= n) break;
    r = cmul(r, z);
  }
  return r;
}

vec4 newton(vec2 z) {
  int p = int(clamp(u_newton_power, 3.0, 8.0) + 0.5);
  float relax = clamp(u_relaxation, 0.85, 1.15);
  float maxIt = min(float(u_max_iterations), 64.0);
  float n = maxIt;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= maxIt) break;
    if (dot(z, z) < 1e-12) z = vec2(1e-4, 0.0);
    vec2 zp1 = cpow_int(z, p - 1);
    vec2 zp = cmul(zp1, z);
    vec2 f = zp - vec2(1.0, 0.0);
    vec2 df = float(p) * zp1;
    float d = max(dot(df, df), 1e-12);
    vec2 stepV = vec2(dot(f, df), f.y * df.x - f.x * df.y) / d;
    z -= relax * stepV;
    if (dot(stepV, stepV) < 1e-10) {
      n = float(i);
      break;
    }
  }
  float a = atan(z.y, z.x);
  float basin = (a + 3.14159265) / 6.2831853;
  float t = basin + n * 0.03 + u_time * 0.05;
  return vec4(palette(t * u_color_shift), 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  vec2 st = uv / u_zoom + u_center;
  if (u_mode == 0) fragColor = julia(st);
  else if (u_mode == 2) fragColor = newton(st);
  else fragColor = mandelbrot(st);

  float r = clamp(u_reveal, 0.0, 1.0);
  float exposure = smoothstep(0.0, 0.65, r);
  float radius = mix(0.08, 2.2, pow(r, 0.55));
  float aperture = 1.0 - smoothstep(radius * 0.5, radius, length(uv));
  aperture = mix(aperture, 1.0, smoothstep(0.85, 1.0, r));
  fragColor.rgb *= exposure * aperture;
}
