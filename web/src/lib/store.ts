import { useSyncExternalStore } from "react";

/**
 * Mutable, render-free state read inside animation loops (useFrame / rAF).
 * Written by the scrubbed dive timeline, never triggers React renders.
 */
export const dive = {
  progress: 0, // 0..1 across hero + journey
  zone: 0, // continuous 0 (surface) … 4 (abyss)
  depth: 0, // metres
};

/* ---------- tiny reactive UI store (nav label, progress line) ---------- */

type UIState = { section: string; journey: number };

let state: UIState = { section: "", journey: 0 };
const listeners = new Set<() => void>();

export function setUI(patch: Partial<UIState>) {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof UIState;
    if (state[key] !== patch[key]) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useUI<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}
