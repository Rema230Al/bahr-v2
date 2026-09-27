import { Fragment, lazy, Suspense, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap, ScrollTrigger, useGSAP } from "../../lib/gsap";
import { usePrefs } from "../../i18n/PrefsProvider";
import type { Stop } from "../../i18n/content";
import { dive, setUI } from "../../lib/store";
import { scrollToTarget } from "../../lib/scroll";
import { useIdle, useInViewport, useIsMobile, useReducedMotion } from "../../lib/hooks";
import { depthAt, HERO_END, holdStart, MOODS, railAt, SEG, segEnd, segmentAt, segStart, zoneAt } from "../../lib/journey";
import { LOGO_ASPECT, LOGO_BODY, LOGO_STROKE, LOGO_VIEWBOX, STROKE_BOX } from "../../lib/logo";
import SplitWords from "../ui/SplitWords";
import MagneticButton from "../ui/Magnetic";
import ErrorBoundary from "../ui/ErrorBoundary";
import { WaveEdge } from "../ui/SeaWaves";
import Contours from "../hero/Contours";
import CoralLetter from "../hero/CoralLetter";

const DiveCanvas = lazy(() => import("../three/DiveCanvas"));

/** Pinned scroll length, in viewport heights. Short enough that each stop arrives quickly. */
const PIN_VH = { mobile: 5.5, desktop: 6.5 };
/** The dive line runs from just under the nav to just above the bottom edge. */
const RAIL_TOP = 96;
const railBottom = (mobile: boolean) => (mobile ? 28 : 40);
/** The one letter Bahr keeps in coral: [word index, character index]. */
const CORAL_LETTER = { en: [0, 2], ar: [0, 0] } as const;

/** Agency logo water: a wave-topped body of water, two wavelengths per logo width so it loops seamlessly. */
const WATER_PATH = (() => {
  const x0 = 93.3, half = 13.25, y = 3, amp = 1.3;
  let d = `M${x0} ${y}`;
  for (let i = 0; i < 8; i++) d += ` q${half / 2} ${i % 2 ? amp : -amp} ${half} 0`;
  return `${d} V56 H${x0} Z`;
})();
const WATER_EMPTY = 50; // translate (user units) with the water fully below the logo
const WATER_FULL = 3.2; // waterline just under the top, so the wave shows

export default function Dive() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const { t, lang, theme } = usePrefs();
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const idle = useIdle();
  const [viewRef, inView] = useInViewport<HTMLDivElement>("100px");
  const pinned = !reduced;
  const [agency, expertise, work, contact] = t.stops;

  // Intro: the mark and the words rise out of the page on load (time-based, not scroll).
  useGSAP(
    () => {
      if (reduced) return;
      const tl = gsap.timeline({ delay: 0.2 });
      tl.from(".contours-intro", { opacity: 0, duration: 2.2, ease: "power1.out" }, 0)
        .from(".hero-logo-intro", { opacity: 0, scale: 0.94, duration: 1.8, ease: "expo.out" }, 0.15)
        .from(".hero-word .mask-inner", { yPercent: 115, duration: 1.4, ease: "expo.out", stagger: 0.1 }, 0.35)
        .from(".hero-fade-intro", { opacity: 0, duration: 1, stagger: 0.1 }, 0.9);
    },
    { scope: root, dependencies: [lang, reduced], revertOnUpdate: true },
  );

  // The scrubbed master timeline: 1 unit of duration = the whole dive.
  useGSAP(
    () => {
      const el = root.current!;
      const html = document.documentElement;
      const mood = MOODS[theme];
      const mixers = (arr: string[]) => arr.slice(0, -1).map((c, i) => gsap.utils.interpolate(c, arr[i + 1]!));
      const mix = { bg: mixers(mood.bg), ink: mixers(mood.ink), accent: mixers(mood.accent), logo: mixers(mood.logo) };
      const at = (fns: ((p: number) => string)[], z: number) => {
        const i = Math.min(fns.length - 1, Math.floor(z));
        return fns[i]!(z - i);
      };

      const railEl = rail.current;
      const lineEl = railEl?.querySelector<HTMLElement>(".rail-line");
      const markerEl = railEl?.querySelector<HTMLElement>(".rail-marker");
      const depthEls = railEl ? Array.from(railEl.querySelectorAll<HTMLElement>(".depth-value")) : [];
      const zoneEls = railEl ? Array.from(railEl.querySelectorAll<HTMLElement>(".depth-zone")) : [];
      const raysEl = el.querySelector<HTMLElement>(".rays-css");

      /* ---------- dive line geometry (viewport px), re-measured on every ScrollTrigger refresh ---------- */
      const g = { x0: 0, top0: 0, h0: 1, sw: 2, x2: 0, h2: 1 };
      const measure = () => {
        const box = el.querySelector<HTMLElement>(".hero-logo-box")!.getBoundingClientRect();
        const sec = el.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const gutter = Math.min(64, Math.max(16, vw * 0.045));
        g.x0 = box.left - sec.left + box.width * STROKE_BOX.cx;
        g.top0 = box.top - sec.top + box.height * STROKE_BOX.top;
        g.h0 = box.height * (STROKE_BOX.bottom - STROKE_BOX.top);
        g.sw = box.width * STROKE_BOX.width;
        g.x2 = lang === "ar" ? gutter : vw - gutter;
        g.h2 = window.innerHeight - RAIL_TOP - railBottom(mobile);
        if (railEl) Object.assign(railEl.style, { left: `${g.x2}px`, top: `${RAIL_TOP}px`, height: `${g.h2}px` });
      };

      // Only touch the DOM when a value actually changes: custom properties on <html> restyle the
      // whole document, so writing them every frame while a stop holds would be wasted work.
      const last: Record<string, string> = {};
      const write = (key: string, value: string, apply: (v: string) => void) => {
        if (last[key] === value) return;
        last[key] = value;
        apply(value);
      };

      const paint = (p: number) => {
        const z = zoneAt(p);
        dive.progress = p;
        dive.zone = z;
        dive.depth = depthAt(p);
        write("bg", at(mix.bg, z), (v) => {
          el.style.backgroundColor = v;
          html.style.setProperty("--nav-bg", v);
        });
        write("ink", at(mix.ink, z), (v) => {
          el.style.setProperty("--dive-ink", v);
          html.style.setProperty("--nav-ink", v);
        });
        write("accent", at(mix.accent, z), (v) => el.style.setProperty("--dive-accent", v));
        write("logo", at(mix.logo, z), (v) => html.style.setProperty("--nav-logo", v));
        write("depth", Math.round(dive.depth).toLocaleString("en-US"), (v) => depthEls.forEach((n) => (n.textContent = v)));
        write("zone", t.zones[Math.round(z)] ?? "", (v) => zoneEls.forEach((n) => (n.textContent = v)));
        if (markerEl) write("marker", (railAt(p) * g.h2).toFixed(1), (v) => (markerEl.style.transform = `translate3d(0, ${v}px, 0)`));
        if (raysEl) write("rays", (Math.max(0, 1 - Math.abs(z - 1) * 1.1) * (z > 0.2 ? 1 : 0)).toFixed(2), (v) => (raysEl.style.opacity = v));
        const { i, travel } = segmentAt(p);
        const label = i < 0 ? -1 : travel > 0.5 ? i : i - 1;
        setUI({ journey: Math.round(railAt(p) * 400) / 400, section: label < 0 ? "" : t.stops[label]!.kicker });
      };

      if (!pinned) {
        // Reduced motion: no pin, no scrub. Each zone is a static section with its own colours.
        el.querySelectorAll<HTMLElement>("[data-zone]").forEach((s) => {
          const z = Number(s.dataset.zone);
          s.style.backgroundColor = mood.bg[z]!;
          s.style.color = mood.ink[z]!;
          s.style.setProperty("--dive-accent", mood.accent[z]!);
        });
        el.querySelectorAll(".agency-water").forEach((w) => w.setAttribute("transform", `translate(0 ${WATER_FULL})`));
        html.style.setProperty("--nav-bg", mood.bg[0]!);
        return () => ["--nav-ink", "--nav-bg", "--nav-logo"].forEach((v) => html.style.removeProperty(v));
      }

      const q = gsap.utils.selector(el);
      const H = () => window.innerHeight;
      // Explicit starting state: everything below the surface is hidden until the timeline reveals it.
      gsap.set(q(".stop-agency, .stop-expertise, .stop-work, .stop-contact, .canvas-wrap"), { autoAlpha: 0 });
      gsap.set(q(".hero-copy"), { autoAlpha: 1 });
      const waterBelow = () => (q(".water")[0] as HTMLElement | undefined)?.offsetHeight ?? H();
      gsap.set(q(".water"), { autoAlpha: 1, yPercent: 0, y: waterBelow });
      measure();

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "dive",
          trigger: el,
          start: "top top",
          end: () => `+=${H() * (mobile ? PIN_VH.mobile : PIN_VH.desktop)}`,
          pin: true,
          scrub: 0.3,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onRefreshInit: measure,
        },
        onUpdate: () => paint(tl.progress()),
      });
      paint(0);

      // Instant visibility switches with explicit start values.
      const toggle = (target: gsap.TweenTarget, from: number, to: number, pos: number) =>
        tl.fromTo(target, { autoAlpha: from }, { autoAlpha: to, duration: 0.0001, immediateRender: false }, pos);
      /** A stop is visible only inside [inAt, hideAt]; its exit tween always finishes before hideAt. */
      const visibleBetween = (stop: Element, inAt: number, hideAt: number) => {
        toggle(stop, 0, 1, inAt - 0.0001);
        toggle(stop, 1, 0, hideAt);
      };

      /* ---------- Surface: words drift up at different depths; the stroke becomes the dive line ---------- */
      const E = HERO_END;
      tl.to(q(".hero-w1"), { y: () => -H() * 1.0, opacity: 0, duration: E * 0.75, ease: "power1.in" }, 0);
      tl.to(q(".hero-w2"), { y: () => -H() * 0.62, opacity: 0, duration: E * 0.8, ease: "power1.in" }, 0);
      tl.to(q(".hero-w3"), { y: () => -H() * 0.4, opacity: 0, duration: E * 0.85, ease: "power1.in" }, 0);
      tl.to(q(".hero-logo"), { y: () => -H() * 0.3, opacity: 0, duration: E * 0.7, ease: "power1.in" }, E * 0.05);
      // explicit start values: these elements are also faded in by the load intro
      tl.fromTo(q(".contours-wrap"), { y: 0, opacity: 1 }, { y: () => -H() * 0.14, opacity: 0, duration: E * 0.95, immediateRender: false }, 0);
      tl.fromTo(q(".hero-fade"), { opacity: 1 }, { opacity: 0, duration: E * 0.2, immediateRender: false }, 0);
      tl.fromTo(q(".water"), { y: waterBelow }, { y: () => -H() * 0.08, duration: E * 0.45, ease: "power2.inOut" }, E * 0.55);
      toggle(q(".water, .hero-copy"), 1, 0, E + 0.001);
      tl.fromTo(q(".canvas-wrap"), { autoAlpha: 0 }, { autoAlpha: 1, duration: SEG * 0.15, immediateRender: false }, E);

      if (lineEl && markerEl) {
        const rest = () => ({ x: g.x0 - g.x2, y: g.top0 - RAIL_TOP, scaleY: g.h0 / g.h2, width: g.sw });
        const stretched = () => ({
          x: g.x0 - g.x2,
          y: g.top0 - RAIL_TOP,
          scaleY: (H() - railBottom(mobile) - g.top0) / g.h2,
          width: Math.max(2, g.sw * 0.55),
        });
        gsap.set(lineEl, { transformOrigin: "50% 0%", xPercent: -50, autoAlpha: 0, ...rest() });
        // Hand-off: at rest the logo's own stroke sits under the words; the moment you scroll, the
        // dive line takes its exact place and starts to stretch.
        toggle(lineEl, 0, 1, 0.0005);
        tl.fromTo(q(".hero-logo-stroke"), { opacity: 1 }, { opacity: 0, duration: 0.0001, immediateRender: false }, 0.0005);
        // 1) the stroke pulls down to the bottom of the screen…
        tl.fromTo(lineEl, { x: () => rest().x, y: () => rest().y, scaleY: () => rest().scaleY, width: () => rest().width },
          { x: () => stretched().x, y: () => stretched().y, scaleY: () => stretched().scaleY, width: () => stretched().width, duration: E * 0.4, ease: "power2.inOut" }, 0);
        // 2) …then slides to the edge and thins into the dive line
        tl.fromTo(lineEl, { x: () => stretched().x, y: () => stretched().y, scaleY: () => stretched().scaleY, width: () => stretched().width },
          { x: 0, y: 0, scaleY: 1, width: 2, duration: E * 0.45, ease: "power3.inOut", immediateRender: false }, E * 0.42);
        const markers = [markerEl, railEl!.querySelector(".rail-foot")];
        gsap.set(markers, { autoAlpha: 0 });
        tl.fromTo(markers, { autoAlpha: 0 }, { autoAlpha: 1, duration: E * 0.12, immediateRender: false }, E * 0.88);

        // Phones: the line steps aside once the contact form arrives, so it never crowds the fields.
        const contactEl = document.getElementById("contact");
        if (mobile && contactEl) {
          ScrollTrigger.create({
            trigger: contactEl,
            start: "top 80%",
            onEnter: () => gsap.to(railEl, { autoAlpha: 0, duration: 0.3 }),
            onLeaveBack: () => gsap.to(railEl, { autoAlpha: 1, duration: 0.3 }),
          });
        }
      }

      /* ---------- 01 · Agency (sunlight): words fall in like light; the logo fills with water ---------- */
      {
        const s = q(".stop-agency")[0]!;
        const inAt = holdStart(0) - SEG * 0.16;
        const outAt = segEnd(0) - SEG * 0.2;
        visibleBetween(s, inAt, outAt + SEG * 0.13);
        tl.fromTo(s.querySelectorAll(".mask-inner"), { yPercent: -115 }, { yPercent: 0, stagger: SEG * 0.012, duration: SEG * 0.18, ease: "power3.out" }, inAt);
        tl.fromTo(s.querySelectorAll(".fade"), { opacity: 0 }, { opacity: 1, duration: SEG * 0.12, ease: "power2.out" }, inAt + SEG * 0.08);
        const water = s.querySelector(".agency-water")!;
        const level = { y: WATER_EMPTY };
        water.setAttribute("transform", `translate(0 ${WATER_EMPTY})`);
        tl.fromTo(level, { y: WATER_EMPTY }, {
          y: WATER_FULL,
          duration: SEG * 0.42,
          ease: "power1.inOut",
          onUpdate: () => water.setAttribute("transform", `translate(0 ${level.y.toFixed(2)})`),
        }, inAt + SEG * 0.04);
        tl.to(s, { opacity: 0, y: -40, duration: SEG * 0.12, ease: "power1.in" }, outAt);
      }

      /* ---------- 02 · Expertise (twilight): drifts up into focus; ends in a blackout ---------- */
      {
        const s = q(".stop-expertise")[0]!;
        const inAt = holdStart(1) - SEG * 0.16;
        const outAt = segEnd(1) - SEG * 0.2;
        visibleBetween(s, inAt, outAt + SEG * 0.13);
        tl.fromTo(s, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: SEG * 0.18, ease: "power2.out" }, inAt);
        tl.fromTo(s.querySelectorAll(".mask-inner"), { yPercent: 115 }, { yPercent: 0, stagger: SEG * 0.01, duration: SEG * 0.16, ease: "power3.out" }, inAt + SEG * 0.02);
        tl.fromTo(s.querySelectorAll(".practice"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: SEG * 0.04, duration: SEG * 0.12, ease: "power2.out" }, inAt + SEG * 0.08);
        tl.to(s, { opacity: 0, duration: SEG * 0.1, ease: "power2.in" }, outAt);
        tl.fromTo(q(".blackout"), { opacity: 0 }, { opacity: 1, duration: SEG * 0.12, immediateRender: false }, outAt + SEG * 0.04);
      }

      /* ---------- 03 · Work (midnight): out of the dark, projects light up like bioluminescence ---------- */
      {
        const s = q(".stop-work")[0]!;
        const inAt = holdStart(2) - SEG * 0.14;
        const outAt = segEnd(2) - SEG * 0.2;
        visibleBetween(s, inAt, outAt + SEG * 0.13);
        tl.to(q(".blackout"), { opacity: 0, duration: SEG * 0.26, ease: "sine.inOut" }, segStart(2) + SEG * 0.1);
        tl.fromTo(s.querySelectorAll(".mask-inner"), { yPercent: 115 }, { yPercent: 0, stagger: SEG * 0.01, duration: SEG * 0.16, ease: "power3.out" }, inAt);
        gsap.utils.shuffle(Array.from(s.querySelectorAll<HTMLElement>(".project"))).forEach((p, k) => {
          const a = inAt + SEG * (0.06 + k * 0.022);
          const d = SEG * 0.035;
          tl.fromTo(p, { opacity: 0 }, { opacity: 0.8, duration: d }, a);
          tl.fromTo(p, { opacity: 0.8 }, { opacity: 0.3, duration: d * 0.6, immediateRender: false }, a + d);
          tl.fromTo(p, { opacity: 0.3 }, { opacity: 1, duration: d, immediateRender: false }, a + d * 1.6);
        });
        tl.to(s, { opacity: 0, y: -60, duration: SEG * 0.12, ease: "power1.in" }, outAt);
      }

      /* ---------- 04 · Let's dive deeper (abyss): the line tightens out of the dark ---------- */
      {
        const s = q(".stop-contact")[0]!;
        const inAt = holdStart(3) - SEG * 0.2;
        toggle(s, 0, 1, inAt - 0.0001);
        const title = s.querySelector(".abyss-title")!;
        if (lang === "ar") {
          tl.fromTo(title, { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: SEG * 0.28, ease: "power2.out" }, inAt);
        } else {
          tl.fromTo(title, { opacity: 0, letterSpacing: "0.4em" }, { opacity: 1, letterSpacing: "-0.045em", duration: SEG * 0.3, ease: "power2.out" }, inAt);
        }
        tl.fromTo(s.querySelectorAll(".fade"), { opacity: 0 }, { opacity: 1, stagger: SEG * 0.04, duration: SEG * 0.12 }, inAt + SEG * 0.16);
      }

      tl.set({}, {}, 1); // lock total duration to exactly 1

      return () => ["--nav-ink", "--nav-bg", "--nav-logo"].forEach((v) => html.style.removeProperty(v));
    },
    { scope: root, dependencies: [lang, theme, mobile, reduced], revertOnUpdate: true },
  );

  // Content keeps clear of the dive line on the end side.
  const stopBase = pinned
    ? "invisible absolute inset-0 flex flex-col justify-center ps-[var(--gutter)] pe-12 md:pe-[calc(var(--gutter)+8rem)] pb-[12svh] pt-28"
    : "relative flex min-h-[100svh] flex-col justify-center px-[var(--gutter)] py-32";

  const [coralWord, coralChar] = CORAL_LETTER[lang];

  return (
    <section
      ref={root}
      id="dive"
      aria-label={t.hero.title.join(" ")}
      className={`relative w-full ${pinned ? "h-[100svh] overflow-hidden" : ""}`}
      style={{ color: pinned ? "var(--dive-ink)" : undefined }}
    >
      {pinned && (
        <>
          <div ref={viewRef} className="canvas-wrap invisible absolute inset-0">
            {idle && (
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <DiveCanvas mobile={mobile} active={inView} />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
          <div
            aria-hidden="true"
            className="rays-css pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light [background:repeating-linear-gradient(100deg,transparent_0_7%,rgba(255,255,255,0.5)_9%,transparent_12%_19%)] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] md:hidden"
          />
          <div aria-hidden="true" className="blackout pointer-events-none absolute inset-0 bg-[#06101f] opacity-0" />
        </>
      )}

      {/* ---------- Hero · 0 m — Bahr's composition: the mark, three words, a sea-floor map ---------- */}
      <div data-zone="0" className={`hero h-[100svh] overflow-hidden ${pinned ? "absolute inset-0" : "relative"}`}>
        <div className="hero-copy absolute inset-0">
          <div className="contours-wrap absolute inset-0">
            <div className="contours-intro absolute inset-0">
              <ErrorBoundary>
                <Contours theme={theme} mobile={mobile} reduced={reduced} />
              </ErrorBoundary>
            </div>
          </div>

          <div
            className="hero-logo-box absolute left-1/2 top-[47%] w-[80vw] -translate-x-1/2 -translate-y-1/2 md:w-[min(64vh,50vw)]"
            style={{ aspectRatio: String(LOGO_ASPECT) }}
          >
            <div className="hero-logo-intro h-full w-full">
              <svg viewBox={LOGO_VIEWBOX} className="hero-logo h-full w-full" style={{ fill: "var(--nav-logo)" }} aria-hidden="true">
                <path d={LOGO_BODY} />
                <path className="hero-logo-stroke" d={LOGO_STROKE} />
              </svg>
            </div>
          </div>

          <h1 className="display pointer-events-none absolute inset-0 text-[12.4vw] leading-none md:text-[clamp(4rem,7.4vw,10rem)]">
            {t.hero.title.map((word, i) => (
              <Fragment key={i}>
                <span
                  className={`hero-word hero-w${i + 1} absolute ${
                    [
                      "start-[6%] top-[22%] md:start-[7%] md:top-[18%]",
                      "end-[6%] top-[44%] md:top-[44%]",
                      "start-[7%] top-[64%] md:start-[12%] md:top-[70%]",
                    ][i]
                  }`}
                >
                  {/* extra room so Arabic dots below the baseline (ي، إ) aren't clipped by the reveal mask */}
                  <span className="mask pb-[0.3em] -mb-[0.3em] pt-[0.1em] -mt-[0.1em]">
                    <span className="mask-inner">
                      {i === coralWord ? <CoralLetter word={word} index={coralChar} /> : word}
                    </span>
                  </span>
                </span>{" "}
              </Fragment>
            ))}
          </h1>

          <p className="hero-fade label absolute bottom-8 start-[var(--gutter)] !text-[11px] leading-relaxed md:bottom-12">
            <span className="hero-fade-intro block">
              {t.hero.caption[0]}
              <br />
              {t.hero.caption[1]}
            </span>
          </p>
          <p className="hero-fade label absolute bottom-8 end-[var(--gutter)] !text-[11px] md:bottom-12" aria-hidden="true">
            <span className="hero-fade-intro block">
              {t.hero.cue} <span className="scroll-cue inline-block">↓</span>
            </span>
          </p>
        </div>
      </div>

      {/* The sea rising over the page */}
      {pinned && (
        <div aria-hidden="true" className="water pointer-events-none absolute inset-x-0 bottom-0 h-[115%]">
          <WaveEdge color={MOODS[theme].bg[1]} className="wave -top-[38px] h-10" />
          <div className="h-full w-full" style={{ background: MOODS[theme].bg[1] }} />
        </div>
      )}

      {/* ---------- 01 · The agency · Sunlight zone — title left, the mark right, filling with water ---------- */}
      <article id="agency" data-zone="1" aria-labelledby="agency-title" className={`stop-agency ${stopBase}`}>
        <div className="grid w-full items-center gap-10 md:grid-cols-[1.3fr_1fr] md:gap-16">
          <div className="max-w-[40rem]">
            <StopHead stop={agency!} />
            <p className="fade mt-8 max-w-md text-[length:var(--fs-md)] font-light leading-relaxed opacity-80 md:mt-10">{agency!.body}</p>
          </div>
          <div className="fade w-[48vw] justify-self-start md:w-[min(30vw,44vh)] md:justify-self-end" aria-hidden="true">
            <svg viewBox={`93.3 3.2 53.1 47.4`} className="block h-auto w-full overflow-visible">
              <defs>
                <clipPath id="agency-logo-clip">
                  <path d={LOGO_BODY} />
                  <path d={LOGO_STROKE} />
                </clipPath>
              </defs>
              <g clipPath="url(#agency-logo-clip)">
                <g className="agency-water" transform={`translate(0 ${WATER_EMPTY})`}>
                  <path className="logo-wave" d={WATER_PATH} fill="#0e61ad" />
                </g>
              </g>
              <g fill="none" stroke="currentColor" strokeWidth="0.16" strokeOpacity="0.7">
                <path d={LOGO_BODY} />
                <path d={LOGO_STROKE} />
              </g>
            </svg>
          </div>
        </div>
      </article>

      {/* ---------- 02 · Expertise · Twilight zone ---------- */}
      <article id="expertise" data-zone="2" aria-labelledby="expertise-title" className={`stop-expertise ${stopBase}`}>
        <StopHead stop={expertise!} size="xl" />
        <ol className="mt-12 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-12">
          {t.expertise.map((x, i) => (
            <li key={x.name} className="practice flex items-baseline gap-4">
              <span className="font-mono text-xs opacity-50">0{i + 1}</span>
              <h3 className="text-[clamp(1.2rem,1.9vw,1.8rem)] font-light tracking-[-0.02em]">{x.name}</h3>
            </li>
          ))}
        </ol>
      </article>

      {/* ---------- 03 · Selected work · Midnight zone ---------- */}
      <article id="work" data-zone="3" aria-labelledby="work-title" className={`stop-work ${stopBase}`}>
        <StopHead stop={work!} size="xl" />
        <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 md:mt-20 md:grid-cols-4 md:gap-x-12 md:gap-y-10">
          {t.projects.map((p) => (
            <li key={p.name} className="project" data-cursor="glow">
              <span
                className="block text-[clamp(1.05rem,2vw,1.9rem)] font-light uppercase leading-none tracking-[-0.02em]"
                style={{
                  color: "var(--dive-accent)",
                  textShadow: "0 0 22px color-mix(in srgb, var(--dive-accent) 45%, transparent)",
                }}
              >
                {p.name}
              </span>
            </li>
          ))}
        </ul>
      </article>

      {/* ---------- 04 · Let's dive deeper · The abyss ---------- */}
      <article
        id="deeper"
        data-zone="4"
        aria-labelledby="contact-title"
        className={`stop-contact ${stopBase} items-center text-center ${pinned ? "ps-12 md:ps-[calc(var(--gutter)+8rem)]" : ""}`}
      >
        <h2 id="contact-title" className="abyss-title display whitespace-nowrap text-[clamp(2.3rem,8.4vw,8.4rem)]">
          {contact!.title}
        </h2>
        <p className="fade mt-8 max-w-md text-[length:var(--fs-md)] font-light leading-relaxed opacity-75">{contact!.body}</p>
        <div className="fade mt-12">
          <MagneticButton onClick={() => scrollToTarget("#contact", 1.4)}>
            {t.nav.talk} <span aria-hidden="true">↓</span>
          </MagneticButton>
        </div>
      </article>

      {/* The dive line: born from the logo's vertical stroke, it follows you down the whole page. */}
      {pinned &&
        createPortal(
          <div ref={rail} aria-hidden="true" className="dive-rail pointer-events-none fixed z-40 w-0" style={{ color: "var(--nav-ink)" }}>
            <div className="rail-line absolute left-0 top-0 h-full w-[2px] rounded-full" style={{ background: "var(--nav-logo)" }} />
            <div className="rail-marker absolute left-0 top-0">
              <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full" style={{ background: "var(--nav-logo)" }} />
              <span className="absolute end-4 top-1/2 hidden -translate-y-1/2 whitespace-nowrap text-end md:block">
                <span className="block font-mono text-[15px] tabular-nums" dir="ltr">
                  <span className="depth-value">0</span> m
                </span>
                <span className="depth-zone label block !text-[9px]" />
              </span>
            </div>
            {/* phones: the counter sits at the foot of the line instead of riding along it */}
            <span className="rail-foot absolute bottom-0 end-3 whitespace-nowrap text-end md:hidden">
              <span className="block font-mono text-[13px] tabular-nums" dir="ltr">
                <span className="depth-value">0</span> m
              </span>
              <span className="depth-zone label block !text-[8px]" />
            </span>
          </div>,
          document.body,
        )}
    </section>
  );
}

function StopHead({ stop, size = "huge" }: { stop: Stop; size?: "huge" | "xl" }) {
  return (
    <>
      <span className="display block text-[length:var(--fs-md)] tabular-nums" style={{ color: "var(--dive-accent)" }}>
        <SplitWords text={stop.number} />
      </span>
      <h2
        id={`${stop.id}-title`}
        className={`display mt-4 ${size === "huge" ? "text-[length:var(--fs-huge)]" : "text-[length:var(--fs-xl)]"}`}
      >
        <SplitWords text={stop.title} />
      </h2>
    </>
  );
}
