import type Lenis from "lenis";
import { ScrollTrigger } from "./gsap";
import { holdStart, SEG } from "./journey";

// Single Lenis instance shared across the app (set by <SmoothScroll />).
let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => {
  lenis = l;
};
export const getLenis = () => lenis;

export function scrollToTarget(target: string | number | HTMLElement, duration = 2.2) {
  if (lenis) {
    lenis.scrollTo(target, { duration, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  if (typeof target === "number") window.scrollTo({ top: target, behavior });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior });
  }
}

/** Scrolls to the settled middle of a stop inside the pinned dive (or to its static section). */
export function scrollToStop(id: string, index: number) {
  const st = ScrollTrigger.getById("dive");
  if (st) {
    const p = holdStart(index) + SEG * 0.3;
    scrollToTarget(st.start + (st.end - st.start) * p, 2.6);
    return;
  }
  scrollToTarget(`#${id}`);
}
