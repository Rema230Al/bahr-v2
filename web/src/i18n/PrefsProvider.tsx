import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { content, type Copy, type Lang } from "./content";
import { applyPrefs, readPrefs, savePrefs, type Prefs, type Theme } from "../lib/prefs";

type Ctx = Prefs & { t: Copy; setLang: (l: Lang) => void; setTheme: (t: Theme) => void };

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
    document.title = content[prefs.lang].meta.title;
  }, [prefs]);

  const setLang = useCallback((lang: Lang) => setPrefs((p) => ({ ...p, lang })), []);
  const setTheme = useCallback((theme: Theme) => setPrefs((p) => ({ ...p, theme })), []);
  const value = useMemo(
    () => ({ ...prefs, t: content[prefs.lang] as Copy, setLang, setTheme }),
    [prefs, setLang, setTheme],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}
