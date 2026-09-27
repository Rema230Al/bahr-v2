import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { dive } from "../../lib/store";
import { cameraZoneAt } from "../../lib/journey";
import { lerp, range, smoother } from "../../lib/math";
import {
  glowFragment,
  glowVertex,
  rayFragment,
  rayVertex,
  snowFragment,
  snowVertex,
  surfaceFragment,
  surfaceVertex,
} from "./shaders";

/** Vertical distance between zones in scene units. */
const ZONE_H = 42;
const BIO_Y = -3 * ZONE_H;

/** Per-zone mood for the scene: how far you can see, how much light hangs in the water. */
const SNOW = [
  { far: 95, opacity: 0.55, color: "#ffffff" }, // surface
  { far: 95, opacity: 0.55, color: "#f4fbff" }, // sunlight
  { far: 60, opacity: 0.6, color: "#bcd8ff" }, // twilight
  { far: 42, opacity: 0.4, color: "#9fc4ff" }, // midnight
  { far: 30, opacity: 0.14, color: "#9fb8d8" }, // abyss
];

const seeded = (n: number) => {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

function Scene({ mobile }: { mobile: boolean }) {
  const { camera } = useThree();
  const pointer = useRef(new THREE.Vector2());
  const colA = useMemo(() => new THREE.Color(), []);
  const colB = useMemo(() => new THREE.Color(), []);
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  /* ---------- marine snow along the whole water column ---------- */
  const snow = useMemo(() => {
    const rnd = seeded(7);
    const n = mobile ? 400 : 1200;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 120;
      pos[i * 3 + 1] = 12 - rnd() * (ZONE_H * 4 + 40);
      pos[i * 3 + 2] = -6 - rnd() * 90;
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: snowVertex,
      fragmentShader: snowFragment,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: mobile ? 2.6 : 2.2 },
        uNear: { value: 8 },
        uFar: { value: 95 },
        uColor: { value: new THREE.Color("#ffffff") },
        uOpacity: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { g, m };
  }, [mobile]);

  /* ---------- bioluminescence in the midnight zone (Bahr blues only) ---------- */
  const bio = useMemo(() => {
    const rnd = seeded(31);
    const n = mobile ? 35 : 70;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const palette = ["#9ad8ff", "#8ec0ff", "#6aa8ea", "#cfe6ff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 110;
      pos[i * 3 + 1] = BIO_Y + (rnd() - 0.5) * ZONE_H * 1.8;
      pos[i * 3 + 2] = -12 - rnd() * 80;
      seed[i] = rnd();
      const c = palette[Math.floor(rnd() * palette.length)]!;
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { uTime: { value: 0 }, uSize: { value: mobile ? 16 : 14 }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { g, m };
  }, [mobile]);

  /* ---------- god rays from above (desktop only — phones get a CSS approximation) ---------- */
  const rays = useMemo(() => {
    if (mobile) return [];
    const rnd = seeded(3);
    return Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: rayVertex,
        fragmentShader: rayFragment,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: rnd() },
          uIntensity: { value: 0 },
          uColor: { value: new THREE.Color("#fffbe8") },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      return {
        m,
        x: (i - 2.5) * 15 + (rnd() - 0.5) * 8,
        z: -30 - rnd() * 45,
        w: 3 + rnd() * 7,
        rot: -0.32 + (rnd() - 0.5) * 0.12,
      };
    });
  }, [mobile]);

  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uColor: { value: new THREE.Color("#f2fbff") } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((state, dt) => {
    const t = reduce ? 0 : state.clock.elapsedTime;
    const cz = cameraZoneAt(dive.progress);
    const z = dive.zone;

    // --- camera: sinks through the column, looking up at the light near the surface ---
    const k = 1 - Math.exp(-dt * 2.5);
    if (!mobile) pointer.current.lerp(state.pointer, k);
    const y = -cz * ZONE_H;
    const lookUp = lerp(26, 0, smoother(range(cz, 0, 1.4)));
    const px = pointer.current.x * 2.2 + Math.sin(t * 0.11) * 1.2;
    const py = pointer.current.y * 1.4 + Math.cos(t * 0.09) * 0.8;
    camera.position.set(px, y + py, 0);
    camera.lookAt(px * 0.3, y + py * 0.3 + lookUp, -60);
    camera.rotateZ(Math.sin(t * 0.07) * 0.012); // a slow roll, like floating

    // --- zone mood ---
    const zi = Math.min(SNOW.length - 2, Math.floor(z));
    const f = z - zi;
    const a = SNOW[zi]!;
    const b = SNOW[zi + 1]!;
    const su = snow.m.uniforms;
    su.uTime!.value = t;
    su.uFar!.value = lerp(a.far, b.far, f);
    su.uOpacity!.value = lerp(a.opacity, b.opacity, f);
    (su.uColor!.value as THREE.Color).copy(colA.set(a.color)).lerp(colB.set(b.color), f);

    const bu = bio.m.uniforms;
    bu.uTime!.value = t;
    bu.uIntensity!.value = smoother(range(z, 2.35, 3)) * (1 - 0.55 * smoother(range(z, 3.2, 4)));

    const rayI = smoother(range(cz, 0.05, 0.5)) * (1 - smoother(range(z, 1.15, 1.9)));
    for (const r of rays) {
      r.m.uniforms.uTime!.value = t;
      r.m.uniforms.uIntensity!.value = rayI;
    }

    surface.uniforms.uTime!.value = t;
    surface.uniforms.uIntensity!.value = 1 - smoother(range(cz, 0.6, 1.6));

  });

  return (
    <>
      <mesh position={[0, 16, -30]} rotation={[Math.PI / 2, 0, 0]} material={surface}>
        <planeGeometry args={[260, 260]} />
      </mesh>
      {rays.map((r, i) => (
        <mesh key={i} position={[r.x, -30, r.z]} rotation={[0, 0, r.rot]} material={r.m}>
          <planeGeometry args={[r.w, 110, 1, 12]} />
        </mesh>
      ))}
      <points geometry={snow.g} material={snow.m} frustumCulled={false} />
      <points geometry={bio.g} material={bio.m} frustumCulled={false} />
    </>
  );
}

export default function DiveCanvas({ mobile, active }: { mobile: boolean; active: boolean }) {
  return (
    <Canvas
      aria-hidden="true"
      frameloop={active ? "always" : "never"}
      dpr={mobile ? 1 : [1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 50, near: 0.1, far: 400, position: [0, 0, 0] }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene mobile={mobile} />
    </Canvas>
  );
}
