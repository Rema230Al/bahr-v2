import { useEffect, useRef } from "react";
import { gsap } from "../../lib/gsap";

/** A restrained cursor: a dot that follows, a ring that trails and opens over interactive elements. */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = dot.current;
    const r = ring.current;
    if (!fine || reduce || !d || !r) return;
    document.documentElement.classList.add("has-custom-cursor");
    gsap.set([d, r], { xPercent: -50, yPercent: -50, opacity: 0 });
    const dx = gsap.quickTo(d, "x", { duration: 0.12, ease: "power3" });
    const dy = gsap.quickTo(d, "y", { duration: 0.12, ease: "power3" });
    const rx = gsap.quickTo(r, "x", { duration: 0.5, ease: "power3" });
    const ry = gsap.quickTo(r, "y", { duration: 0.5, ease: "power3" });
    let shown = false;

    const move = (e: PointerEvent) => {
      if (!shown) {
        gsap.to([d, r], { opacity: 1, duration: 0.4 });
        shown = true;
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };
    const leave = () => {
      shown = false;
      gsap.to([d, r], { opacity: 0, duration: 0.3 });
    };
    const over = (e: Event) => {
      const t = (e.target as HTMLElement).closest?.("a, button, input, select, textarea, label, [data-cursor]");
      if (t) r.setAttribute("data-hover", (t as HTMLElement).dataset.cursor ?? "link");
      else r.removeAttribute("data-hover");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] hidden [@media(pointer:fine)]:block">
      <div ref={dot} className="fixed left-0 top-0 h-[5px] w-[5px] rounded-full bg-white mix-blend-difference" />
      <div
        ref={ring}
        className="fixed left-0 top-0 h-8 w-8 rounded-full border border-white/50 mix-blend-difference transition-[width,height,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-[hover=glow]:h-20 data-[hover=glow]:w-20 data-[hover=link]:h-12 data-[hover=link]:w-12 data-[hover]:border-white/90"
      />
    </div>
  );
}
