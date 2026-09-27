/* GLSL for the dive. Everything is additive light on a transparent canvas; the DOM behind it carries
   the water colour, so fading a particle out by distance reads exactly like underwater fog. */

export const snowVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uNear;
uniform float uFar;
attribute float aSeed;
varying float vAlpha;

void main() {
  vec3 p = position;
  // slow sway (currents) and a gentle sink that wraps every 10 units, faded at the wrap
  p.x += sin(uTime * 0.12 + aSeed * 40.0) * 0.9;
  p.z += cos(uTime * 0.09 + aSeed * 23.0) * 0.6;
  float fall = mod(uTime * (0.18 + aSeed * 0.35) + aSeed * 10.0, 10.0);
  p.y -= fall;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.45 + aSeed) * (60.0 / -mv.z);
  float wrap = smoothstep(0.0, 1.2, fall) * smoothstep(10.0, 8.8, fall);
  vAlpha = smoothstep(uFar, uNear, -mv.z) * wrap;
}
`;

export const snowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
}
`;

export const glowVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.07 + aSeed * 30.0) * 1.6;
  p.y += sin(uTime * 0.05 + aSeed * 17.0) * 1.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // each light breathes on its own slow rhythm, mostly dark, briefly bright
  float pulse = pow(0.5 + 0.5 * sin(uTime * (0.35 + aSeed * 0.9) + aSeed * 60.0), 3.0);
  gl_PointSize = uSize * (0.6 + aSeed * 0.8) * (0.7 + pulse * 0.6) * (60.0 / -mv.z);
  vAlpha = (0.15 + pulse * 0.85) * smoothstep(140.0, 20.0, -mv.z);
  vColor = aColor;
}
`;

export const glowFragment = /* glsl */ `
uniform float uIntensity;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.12, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d);
  float a = (core * 0.9 + halo * halo * 0.5) * vAlpha * uIntensity;
  gl_FragColor = vec4(vColor, a);
}
`;

export const rayVertex = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;

void main() {
  vUv = uv;
  vec3 p = position;
  // refracted light wavers
  p.x += sin(uTime * 0.35 + uSeed * 9.0 + uv.y * 2.5) * 1.4 * (1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const rayFragment = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform vec3 uColor;

void main() {
  float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
  float fall = pow(vUv.y, 1.2);
  float flicker = 0.6 + 0.4 * sin(uTime * 0.5 + uSeed * 12.0 + vUv.y * 4.0);
  gl_FragColor = vec4(uColor, edge * edge * fall * flicker * uIntensity * 0.42);
}
`;

export const surfaceVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* The underside of the sea surface: thin moving caustic lines, brightest overhead. */
export const surfaceFragment = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;

void main() {
  vec2 p = (vUv - 0.5) * 34.0;
  float t = uTime * 0.35;
  float v = sin(p.x + sin(p.y * 0.8 + t) * 1.6) + sin(p.y * 1.1 + sin(p.x * 0.7 - t * 0.9) * 1.4);
  float lines = pow(1.0 - abs(sin(v * 1.4)), 9.0);
  float window = 1.0 - smoothstep(0.02, 0.48, length(vUv - 0.5));
  float a = (lines * 0.7 + 0.18) * window * uIntensity;
  gl_FragColor = vec4(uColor, a);
}
`;
