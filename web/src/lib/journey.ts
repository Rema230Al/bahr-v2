import { clamp01, lerp, smoother } from "./math";

/**
 * The hero + dive is ONE scrubbed sequence (progress 0..1).
 *  0        → HERO_END : title lifts away, the water rises over the screen (the plunge)
 *  then 4 equal segments (Agency, Expertise, Work, Contact), each = travel (TRAVEL) + hold.
 */
export const STOP_COUNT = 4;
export const HERO_END = 0.14;
export const SEG = (1 - HERO_END) / STOP_COUNT;
export const TRAVEL = 0.4;

export const segStart = (i: number) => HERO_END + i * SEG;
export const holdStart = (i: number) => segStart(i) + SEG * TRAVEL;
export const segEnd = (i: number) => segStart(i) + SEG;

/** Depth of each zone: surface, sunlight, twilight, midnight, abyss. */
export const DEPTHS = [0, 200, 1000, 4000, 6000];
const PLUNGE_DEPTH = 8;

export function segmentAt(p: number) {
  if (p < HERO_END) return { i: -1, travel: clamp01(p / HERO_END), hold: 0 };
  const k = Math.min(STOP_COUNT - 1e-6, (p - HERO_END) / SEG);
  const i = Math.floor(k);
  const f = k - i;
  return { i, travel: clamp01(f / TRAVEL), hold: clamp01((f - TRAVEL) / (1 - TRAVEL)) };
}

/**
 * Continuous colour-mood index: 0 = surface … 4 = abyss. The rising water already carries the
 * sunlight colour, so once it has covered the screen the mood sits at 1 until the Agency stop.
 */
export function zoneAt(p: number) {
  const { i, travel } = segmentAt(p);
  if (i < 0) return 0;
  if (i === 0) return 1;
  return i + smoother(travel);
}

/** Continuous camera position through the water column: 0 = just under the surface … 4 = abyss. */
export function cameraZoneAt(p: number) {
  const { i, travel } = segmentAt(p);
  if (i < 0) return 0;
  return i + smoother(travel);
}

/** Live depth in metres. Keeps sinking slowly while a stop holds, so the counter never feels frozen. */
export function depthAt(p: number) {
  const { i, travel, hold } = segmentAt(p);
  if (i < 0) return lerp(0, PLUNGE_DEPTH, travel);
  const from = i === 0 ? PLUNGE_DEPTH : DEPTHS[i]!;
  const to = DEPTHS[i + 1]!;
  const creep = i === STOP_COUNT - 1 ? 0 : (DEPTHS[i + 2]! - to) * 0.05;
  return lerp(from, to, smoother(travel)) + creep * hold;
}

/** Progress-line position: each stop is a tick at (i+1)/4. */
export function railAt(p: number) {
  const { i, travel } = segmentAt(p);
  if (i < 0) return 0;
  return clamp01((i + travel) / STOP_COUNT);
}

/* ---------- colour moods per zone (index = zone) ---------- */

export type Mood = { bg: string[]; ink: string[]; accent: string[]; logo: string[] };

export const MOODS: Record<"light" | "dark", Mood> = {
  light: {
    bg: ["#e6e6df", "#a9c4d0", "#1a4f86", "#0c2240", "#0a1628"],
    ink: ["#242423", "#14262f", "#eef2f6", "#dde6f0", "#d3dce8"],
    accent: ["#0e61ad", "#0b4f8f", "#9cc8f5", "#8ec5ff", "#8ec0ff"],
    logo: ["#0e61ad", "#0b4f8f", "#9cc8f5", "#7fb3ea", "#7fb3ea"],
  },
  dark: {
    bg: ["#101d30", "#1e4a6b", "#1a4577", "#0c2240", "#0a1628"],
    ink: ["#dfe6ee", "#e6edf3", "#eef2f6", "#dde6f0", "#d3dce8"],
    accent: ["#6aa8ea", "#9cd0ee", "#9cc8f5", "#8ec5ff", "#8ec0ff"],
    logo: ["#6aa8ea", "#8cc4ee", "#9cc8f5", "#7fb3ea", "#7fb3ea"],
  },
};
