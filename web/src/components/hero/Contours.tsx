import { useEffect, useRef } from "react";
import { dive } from "../../lib/store";
import { HERO_END } from "../../lib/journey";

/**
 * Sea-floor contour map behind the hero, in the spirit of Bahr's own contour backdrop.
 * One small WebGL2 fragment shader: isolines of a slowly drifting height field (the "water"),
 * plus soft rings that spread from wherever the cursor moves. No three.js needed.
 */
const MAX_RIPPLES = 6;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;       // css pixels
uniform float uDpr;
uniform float uTime;
uniform vec4 uRipples[${MAX_RIPPLES}]; // x, y (css px, top-left origin), birth time, strength
uniform vec3 uLine;
uniform vec3 uAccent;
uniform float uOpacity;
uniform int uOctaves;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= uOctaves) break;
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr; // css px, top-left origin
  vec2 q = px / max(uRes.x, uRes.y) * 3.2;
  float t = uTime * 0.035;
  // two layers drifting in different directions read as slow, deep water movement
  float h = fbm(q + vec2(t, -t * 0.6)) * 0.75 + fbm(q * 1.6 - vec2(t * 0.7, t * 0.3)) * 0.25;

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 3.5) continue;
    float d = length(px - r.xy);
    float front = age * 190.0;                       // ring travels outward
    float ring = exp(-pow((d - front) / 70.0, 2.0)); // soft band around the front
    h += sin((d - front) * 0.05) * ring * exp(-age * 1.1) * 0.022 * r.w;
  }

  float bands = h * 22.0;
  float w = fwidth(bands);
  float f = fract(bands);
  float line = 1.0 - smoothstep(0.0, w * 1.3, min(f, 1.0 - f));

  // one highlighted contour in Bahr blue, like their map
  float level = abs(h - 0.52) * 22.0;
  float accent = 1.0 - smoothstep(w * 0.6, w * 2.2, level);

  // fade toward the top and bottom edges
  float y = px.y / uRes.y;
  float mask = smoothstep(0.02, 0.25, y) * (1.0 - smoothstep(0.78, 1.0, y));

  vec3 col = mix(uLine, uAccent, accent);
  float a = max(line * 0.5, accent * 0.85) * mask * uOpacity;
  outColor = vec4(col * a, a);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

export default function Contours({ theme, mobile, reduced }: { theme: "light" | "dark"; mobile: boolean; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!canvas || !gl) return; // no WebGL2 → the hero simply has no contours

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uDpr = u("uDpr"), uTime = u("uTime"), uRipples = u("uRipples"), uOpacity = u("uOpacity");

    // Colours from Bahr's own contour backdrop.
    const light = theme === "light";
    gl.uniform3fv(u("uLine"), hex(light ? "#8f999c" : "#5d6c77"));
    gl.uniform3fv(u("uAccent"), hex(light ? "#326aaa" : "#4f86c6"));
    gl.uniform1f(uOpacity, light ? 0.75 : 0.8);
    gl.uniform1i(u("uOctaves"), mobile ? 3 : 4);

    const dpr = 1; // fwidth() anti-aliases the lines, so 1× stays crisp enough and is far cheaper
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);

    const ripples = new Float32Array(MAX_RIPPLES * 4);
    let next = 0, lastX = -1e4, lastY = -1e4, lastAt = 0;
    const start = performance.now();
    const now = () => (performance.now() - start) / 1000;

    const onMove = (e: PointerEvent) => {
      if (dive.progress > HERO_END) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const t = now();
      if (Math.hypot(x - lastX, y - lastY) < 60 || t - lastAt < 0.12) return;
      lastX = x; lastY = y; lastAt = t;
      ripples.set([x, y, t, e.pointerType === "mouse" ? 1 : 1.4], next * 4);
      next = (next + 1) % MAX_RIPPLES;
    };

    const draw = (t: number) => {
      gl.uniform1f(uTime, t);
      gl.uniform4fv(uRipples, ripples);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0, lastDraw = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      // Only animate while the hero is on screen, at ~30fps (slow water doesn't need 60).
      if (dive.progress > HERO_END * 1.05 || document.hidden || ts - lastDraw < 32) return;
      lastDraw = ts;
      draw(now());
    };

    if (reduced) draw(0); // one still frame, no flow, no ripples
    else {
      window.addEventListener("pointermove", onMove, { passive: true });
      draw(0);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [theme, mobile, reduced]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
