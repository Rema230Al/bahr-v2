import { useEffect, useRef, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

/** Tracks whether the element is within the viewport (pauses the offscreen canvas). */
export function useInViewport<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** True once the browser is idle after first paint — used to defer loading the 3D scene. */
export function useIdle(timeout = 1200) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setIdle(true), 300);
    return () => clearTimeout(id);
  }, [timeout]);
  return idle;
}
