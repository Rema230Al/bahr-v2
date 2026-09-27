import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefs } from "../../i18n/PrefsProvider";
import { useUI } from "../../lib/store";
import { scrollToStop, scrollToTarget } from "../../lib/scroll";
import Logo from "./Logo";

const STOP_LINKS = [
  { id: "agency", index: 0, key: "agency" },
  { id: "expertise", index: 1, key: "expertise" },
  { id: "work", index: 2, key: "work" },
] as const;

export default function Nav() {
  const { t, lang, theme, setLang, setTheme } = usePrefs();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const section = useUI((s) => s.section);
  const journey = useUI((s) => s.journey);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname, lang]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const goStop = (id: string, index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (onHome) scrollToStop(id, index);
    else navigate(`/#${id}`);
  };
  const goContact = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (onHome) scrollToTarget("#contact", 3);
    else navigate("/#contact");
  };

  const toggles = (
    <>
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        aria-label={t.nav.lang.aria}
        lang={lang === "en" ? "ar" : "en"}
        className="link-underline font-mono text-[12px] uppercase tracking-[0.14em]"
      >
        {t.nav.lang.label}
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label={theme === "light" ? t.nav.theme.toDark : t.nav.theme.toLight}
        className="grid h-8 w-8 place-items-center rounded-full border border-current/25 transition-colors hover:border-current/70"
      >
        <span
          aria-hidden="true"
          className="block h-3 w-3 rounded-full border border-current"
          style={{ background: theme === "light" ? "transparent" : "currentColor" }}
        />
      </button>
    </>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,backdrop-filter,border-color] duration-700 ${
        scrolled ? "border-current/10 backdrop-blur-md" : "border-transparent"
      }`}
      style={{
        // With the menu open the page behind is covered by the theme background, so use theme colours.
        color: open ? "var(--ink)" : "var(--nav-ink)",
        ["--nav-logo" as string]: open ? "var(--logo)" : undefined,
        backgroundColor: scrolled && !open ? "color-mix(in srgb, var(--nav-bg) 45%, transparent)" : "transparent",
      }}
    >
      <nav aria-label="Primary" className="flex items-center justify-between gap-4 px-[var(--gutter)] py-3 md:py-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/"
            aria-label={t.nav.home}
            onClick={(e) => {
              if (onHome) {
                e.preventDefault();
                scrollToTarget(0, 3);
              }
            }}
          >
            <Logo />
          </Link>
          {onHome && (
            <span className="label hidden truncate !text-[10px] sm:inline" aria-live="polite">
              {section}
            </span>
          )}
        </div>

        <ul className="hidden items-center gap-7 md:flex">
          {STOP_LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`/#${l.id}`}
                onClick={goStop(l.id, l.index)}
                className="link-underline track-hover font-mono text-[11px] uppercase tracking-[0.16em]"
              >
                {t.nav[l.key]}
              </a>
            </li>
          ))}
          <li>
            <Link
              to="/careers"
              aria-current={pathname === "/careers" ? "true" : undefined}
              className="link-underline track-hover font-mono text-[11px] uppercase tracking-[0.16em]"
            >
              {t.nav.careers}
            </Link>
          </li>
          <li>
            <a
              href="/#contact"
              onClick={goContact}
              className="inline-flex items-center gap-2 rounded-full border border-current/30 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-300 hover:bg-[var(--nav-ink)] hover:text-[var(--nav-bg)]"
            >
              {t.nav.talk} <span aria-hidden="true" className="rtl:-scale-x-100">→</span>
            </a>
          </li>
          <li className="flex items-center gap-4">{toggles}</li>
        </ul>

        <button
          type="button"
          className="font-mono text-[11px] uppercase tracking-[0.16em] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t.nav.close : t.nav.menu}
        </button>
      </nav>

      {/* Dive progress: how deep you are */}
      {onHome && (
        <div
          className="relative mx-[var(--gutter)] h-px bg-current/15"
          role="progressbar"
          aria-label={t.nav.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(journey * 100)}
        >
          <div
            className="absolute inset-y-0 start-0 w-full origin-left bg-current/70 rtl:origin-right"
            style={{ transform: `scaleX(${journey})` }}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`absolute top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full transition-colors duration-500 ltr:-translate-x-1/2 rtl:translate-x-1/2 ${
                journey >= i / 4 - 0.001 ? "bg-current" : "bg-current/25"
              }`}
              style={{ insetInlineStart: `${(i / 4) * 100}%` }}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-0 -z-10 flex h-[100svh] flex-col justify-between bg-bg px-[var(--gutter)] pb-10 pt-24 text-ink md:hidden"
          >
            <ul className="flex flex-col gap-2">
              {STOP_LINKS.map((l, i) => (
                <motion.li
                  key={l.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                >
                  <a href={`/#${l.id}`} onClick={goStop(l.id, l.index)} className="display block py-1 text-[2.6rem]">
                    {t.nav[l.key]}
                  </a>
                </motion.li>
              ))}
              <motion.li initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Link to="/careers" className="display block py-1 text-[2.6rem]">
                  {t.nav.careers}
                </Link>
              </motion.li>
              <motion.li initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <a href="/#contact" onClick={goContact} className="display block py-1 text-[2.6rem] text-accent">
                  {t.nav.talk}
                </a>
              </motion.li>
            </ul>
            <div className="flex items-center justify-between">
              <a href="mailto:dive@b7r.agency" className="font-mono text-sm">
                dive@b7r.agency
              </a>
              <div className="flex items-center gap-5">{toggles}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
