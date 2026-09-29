import { useRef } from "react";
import { Link } from "react-router-dom";
import { gsap, useGSAP } from "../../lib/gsap";
import { usePrefs } from "../../i18n/PrefsProvider";
import { scrollToTarget } from "../../lib/scroll";
import MagneticButton from "../ui/Magnetic";
import SplitWords from "../ui/SplitWords";

/** The bottom of the sea: one line, and the way back up. */
export default function Finale() {
  const root = useRef<HTMLElement>(null);
  const { t, lang } = usePrefs();
  const f = t.finale;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".fn-line .mask-inner", {
        yPercent: 115,
        stagger: 0.06,
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", toggleActions: "play none none reverse" },
      });
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  return (
    <footer ref={root} className="relative overflow-hidden px-[var(--gutter)] pb-10 pt-20 md:pt-28" style={{ backgroundColor: "#0a1628", color: "#dfe6ee" }}>
      <div className="relative flex flex-col items-center text-center">
        <p className="fn-line display text-[length:var(--fs-xl)]">
          <SplitWords text={f.line} />
        </p>
        <div className="mt-10 md:mt-14">
          <MagneticButton onClick={() => scrollToTarget(0, 3)} aria-label={f.back}>
            {f.back} <span aria-hidden="true">↑</span>
          </MagneticButton>
        </div>
      </div>

      {/* Columns wrap (1 → 2 → 4) instead of squeezing. From md up, the fixed dive rail and its
          depth readout sit on the inline-end edge, so the last column keeps clear of them (pe-28). */}
      <div className="relative mt-20 grid gap-x-10 gap-y-6 border-t border-white/10 pt-8 text-sm sm:grid-cols-2 md:mt-28 md:pe-28 lg:grid-cols-4">
        <p>
          {f.place}
          {f.region.map((line) => (
            <span key={line} className="block opacity-60">
              {line}
            </span>
          ))}
        </p>
        <a href="mailto:dive@b7r.agency" className="link-underline self-start" dir="ltr">
          dive@b7r.agency
        </a>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="https://www.linkedin.com/company/bybahr" target="_blank" rel="noopener noreferrer" className="link-underline self-start">
            {f.linkedin} <span aria-hidden="true">↗</span>
          </a>
          <Link to="/careers" className="link-underline self-start">
            {t.nav.careers}
          </Link>
        </div>
        <p className="opacity-60 lg:text-end">
          {f.rights} · {lang === "ar" ? "مفهوم تصميمي" : "Concept redesign"}
        </p>
      </div>
    </footer>
  );
}
