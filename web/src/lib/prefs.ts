import type { Lang } from "../i18n/content";

export type Theme = "light" | "dark";
export type Prefs = { lang: Lang; theme: Theme };

const KEY = "bahr:prefs";

export function readPrefs(): Prefs {
  let saved: Partial<Prefs> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
  } catch {
    /* storage can be unavailable (private mode) — fall back to defaults */
  }
  const navLang = typeof navigator !== "undefined" && navigator.language?.startsWith("ar") ? "ar" : "en";
  return {
    lang: saved.lang === "ar" || saved.lang === "en" ? saved.lang : navLang,
    theme: saved.theme === "dark" || saved.theme === "light" ? saved.theme : "light",
  };
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function applyPrefs(p: Prefs) {
  const html = document.documentElement;
  html.lang = p.lang;
  html.dir = p.lang === "ar" ? "rtl" : "ltr";
  html.dataset.theme = p.theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", p.theme === "dark" ? "#101d30" : "#e6e6df");
}
