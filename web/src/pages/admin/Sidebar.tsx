import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../../components/ui/Logo";
import { usePrefs } from "../../i18n/PrefsProvider";
import { VIEWS, type View } from "./filters";
import { Avatar, Chevron } from "./ui";

const ICONS: Record<View, ReactNode> = {
  leads: <path d="M2.5 3.5h3v9h-3zM6.5 3.5h3v6h-3zM10.5 3.5h3v4h-3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  inquiries: (
    <path d="M2.5 9.5h3l1 1.5h3l1-1.5h3M2.5 9.5 4 3.5h8l1.5 6v3h-11z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  ),
  openings: (
    <path d="M2.5 5.5h11v7h-11zM6 5.5v-2h4v2M2.5 8.5h11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  ),
};
const ORDER: View[] = ["leads", "inquiries", "openings"];

/** Navy sidebar on desktop; a top bar with a menu on smaller screens. */
export default function Sidebar({
  view,
  onView,
  email,
  onSignOut,
}: {
  view: View;
  onView: (v: View) => void;
  email: string;
  onSignOut: () => void;
}) {
  const { theme, setTheme } = usePrefs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className="sticky top-0 z-40 bg-[var(--side-bg)] text-[var(--side-ink)] [--nav-logo:#9cc8f5] lg:flex lg:h-svh lg:w-60 lg:flex-none lg:flex-col">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:px-5 lg:pb-7 lg:pt-6">
        <Link to="/" className="flex items-center gap-3 rounded-md" aria-label="Bahr — back to the site">
          <Logo className="!h-7" />
          <span className="text-[15px] font-semibold tracking-tight">
            Bahr <span className="font-normal text-[var(--side-muted)]">Admin</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-menu"
          className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-white/10 lg:hidden"
        >
          Menu
          <Chevron className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div
        id="admin-menu"
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-6 bg-[var(--side-bg)] px-3 pb-4 pt-2 shadow-[0_16px_32px_-16px_rgb(0_0_0/0.5)] lg:static lg:flex lg:flex-1 lg:pt-0 lg:shadow-none`}
      >
        <nav aria-label="Admin">
          <p className="px-2 pb-2 text-xs font-medium text-[var(--side-muted)]">Workspace</p>
          <ul className="grid gap-0.5">
            {ORDER.map((v) => (
              <li key={v}>
                <button
                  type="button"
                  aria-current={view === v ? "page" : undefined}
                  onClick={() => {
                    onView(v);
                    setOpen(false);
                  }}
                  className={`relative flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-200 ${
                    view === v ? "font-medium text-white" : "text-[var(--side-ink)]/80 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {view === v && (
                    <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-md bg-white/10" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} />
                  )}
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="relative h-4 w-4">
                    {ICONS[v]}
                  </svg>
                  <span className="relative">{VIEWS[v].title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-1 border-t border-white/10 pt-4 lg:mt-auto">
          <button
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-[var(--side-ink)]/80 hover:bg-white/[0.06] hover:text-white"
          >
            <span aria-hidden="true" className="grid h-4 w-4 place-items-center">
              <span className="block h-3 w-3 rounded-full border border-current" style={{ background: theme === "dark" ? "currentColor" : "transparent" }} />
            </span>
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="[&>span]:bg-white/12 [&>span]:text-white">
              <Avatar name={email} size="sm" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--side-muted)]" title={email}>
              {email}
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-[var(--side-ink)]/80 hover:bg-white/[0.06] hover:text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M6.5 3H3.5v10h3M10 5l3 3-3 3M13 8H6.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
