import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import { getLenis, setLenis } from "../../lib/scroll";
import { useReducedMotion } from "../../lib/hooks";

/** Lenis smooth scrolling driven by GSAP's ticker. Disabled (native scroll) with reduced motion. */
export default function SmoothScroll() {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.16, wheelMultiplier: 1.1, touchMultiplier: 1.6 });
    setLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, [reduced]);

  // New page → start at the top and let triggers remeasure.
  useEffect(() => {
    if (window.location.hash) return;
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
