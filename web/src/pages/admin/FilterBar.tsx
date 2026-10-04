import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { STAGES } from "../../lib/api";
import { ALL_TIME, isValidRange, presetRange, type Preset, type RangeState } from "../../lib/dateRange";
import { TextField } from "../../components/ui/Field";
import { NO_FILTERS, VIEWS, type Control, type Filters, type View } from "./filters";
import { ownerName, SERVICES } from "./format";
import { Button, Chevron } from "./ui";

/**
 * One compact row: search, a date range dropdown with presets, and small dropdown buttons for
 * the view's own filters. Whatever is active shows below as a removable chip.
 * The server re-validates the dates (real dates, To ≥ From); the rest filters what's loaded.
 */
const PRESETS: [Preset, string][] = [
  ["all", "All time"],
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["month", "This month"],
  ["30d", "Last 30 days"],
  ["custom", "Custom range"],
];

const PILL =
  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border bg-[var(--card)] px-3 text-sm transition-colors duration-200 hover:bg-ink/[0.03]";

const pretty = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** "Today", "Last 7 days" — or the exact dates for a custom range. */
function rangeText(r: RangeState) {
  if (r.preset !== "custom") return PRESETS.find(([p]) => p === r.preset)?.[1] ?? "All time";
  if (!r.from && !r.to) return "Custom range";
  return `${r.from ? pretty(r.from) : "Any time"} – ${r.to ? pretty(r.to) : "today"}`;
}

type Admin = { id: number; email: string };

export default function FilterBar({
  view,
  filters,
  onFilters,
  dates,
  onDates,
  admins,
}: {
  view: View;
  filters: Filters;
  onFilters: (f: Filters) => void;
  dates: RangeState;
  onDates: (r: RangeState) => void;
  admins: Admin[];
}) {
  const { search, controls, dateLabel } = VIEWS[view];
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  const options: Record<Control, { label: string; any: string; items: [string, string][] }> = {
    stage: { label: "Stage", any: "Any stage", items: STAGES },
    service: { label: "Service", any: "Any service", items: SERVICES },
    owner: {
      label: "Owner",
      any: "Any owner",
      items: [["none", "Unassigned"], ...admins.map((a): [string, string] => [String(a.id), a.email])],
    },
  };

  const chips: { key: string; text: string; clear: () => void }[] = [];
  if (filters.q.trim()) chips.push({ key: "q", text: `“${filters.q.trim()}”`, clear: () => set({ q: "" }) });
  if ((dates.from || dates.to) && isValidRange(dates)) {
    chips.push({ key: "dates", text: `${dateLabel}: ${rangeText(dates)}`, clear: () => onDates(ALL_TIME) });
  }
  for (const c of controls) {
    const value = filters[c];
    if (value === "all") continue;
    const label = options[c].items.find(([v]) => v === value)?.[1] ?? value;
    chips.push({ key: c, text: `${options[c].label}: ${c === "owner" && value !== "none" ? ownerName(label) : label}`, clear: () => set({ [c]: "all" }) });
  }

  return (
    <div className="mb-6">
      <div role="search" aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-60 lg:w-64">
          <span className="sr-only">Search</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted">
            <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={search}
            className="field h-9 !py-0 !ps-9"
          />
        </label>

        <DateMenu label={dateLabel} value={dates} onChange={onDates} />

        {controls.map((c) => (
          <SelectPill
            key={c}
            label={options[c].label}
            any={options[c].any}
            value={filters[c]}
            options={options[c].items}
            display={c === "owner" ? (v, l) => (v === "none" ? l : ownerName(l)) : undefined}
            onChange={(v) => set({ [c]: v })}
          />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {chips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul aria-label="Active filters" aria-live="polite" className="flex flex-wrap items-center gap-2 pt-3">
              {chips.map((c) => (
                <li key={c.key} data-testid="filter-chip" className="inline-flex h-7 items-center gap-1 rounded-full bg-accent/10 pe-1 ps-3 text-xs font-medium text-accent">
                  {c.text}
                  <button
                    type="button"
                    onClick={c.clear}
                    aria-label={`Remove filter ${c.text}`}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-accent/15"
                  >
                    <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2 w-2">
                      <path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
              {chips.length > 1 && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onFilters({ ...NO_FILTERS });
                      onDates(ALL_TIME);
                    }}
                    className="h-7 rounded-md px-2 text-xs font-medium text-muted hover:text-ink"
                  >
                    Clear all
                  </button>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const POPOVER = "card absolute start-0 top-full z-30 mt-2 p-1.5 shadow-[0_12px_32px_-12px_rgb(12_34_64/0.3)]";
const POP_MOTION = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 flex-none">
    <path d="m2.5 6.5 2.5 2.5 4.5-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Open state for a popover: closes on a click outside or Escape (focus goes back to its button). */
function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, root };
}

/** A small dropdown button with a styled menu of options (arrow keys move, Enter picks). */
function SelectPill({
  label,
  any,
  value,
  options,
  display,
  onChange,
}: {
  label: string;
  any: string;
  value: string;
  options: [string, string][];
  display?: (value: string, label: string) => string;
  onChange: (v: string) => void;
}) {
  const { open, setOpen, root } = usePopover();
  const menu = useRef<HTMLDivElement>(null);
  const current = options.find(([v]) => v === value);
  const active = value !== "all" && current;
  const items: [string, string][] = [["all", any], ...options];

  // On open, focus the chosen option so arrow keys start from there.
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    all[(to + all.length) % all.length]?.focus();
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${PILL} ${active ? "border-accent/40 text-accent" : "border-line"}`}
      >
        <span>
          {label}
          {active && <span className="font-medium">: {display ? display(current[0], current[1]) : current[1]}</span>}
        </span>
        <Chevron className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div ref={menu} role="menu" aria-label={label} onKeyDown={onKeyDown} {...POP_MOTION} className={`${POPOVER} w-max min-w-44 max-w-[min(18rem,calc(100vw-2rem))]`}>
            {items.map(([v, l], i) => (
              <div key={v}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === v}
                  onClick={() => pick(v)}
                  className={`flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-start text-sm outline-offset-0 hover:bg-ink/[0.05] focus-visible:bg-ink/[0.05] ${
                    value === v ? "font-medium text-accent" : v === "all" ? "text-muted" : ""
                  }`}
                >
                  <span className="truncate">{l}</span>
                  {value === v && <Check />}
                </button>
                {i === 0 && <div className="my-1 border-t border-line" role="separator" />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateMenu({ label, value, onChange }: { label: string; value: RangeState; onChange: (r: RangeState) => void }) {
  const { open, setOpen, root } = usePopover();
  const invalid = !isValidRange(value);
  const active = !!(value.from || value.to) && !invalid;

  const pick = (p: Preset) => {
    onChange(presetRange(p, value));
    if (p !== "custom") setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`${PILL} ${active ? "border-accent/40 text-accent" : invalid ? "border-signal" : "border-line"}`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 opacity-70">
          <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 6.5h11M5.5 1.75v3M10.5 1.75v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span>
          {label}: <span className="font-medium">{rangeText(value)}</span>
        </span>
        <Chevron className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Date range" {...POP_MOTION} className={`${POPOVER} w-[min(20rem,calc(100vw-2rem))]`}>
            <ul className="grid gap-0.5" aria-label="Presets">
              {PRESETS.map(([p, name]) => (
                <li key={p}>
                  <button
                    type="button"
                    aria-pressed={value.preset === p}
                    onClick={() => pick(p)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-sm hover:bg-ink/[0.05] ${
                      value.preset === p ? "font-medium text-accent" : ""
                    }`}
                  >
                    {name}
                    {value.preset === p && <Check />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line px-1 pt-3">
              <TextField
                label="From"
                type="date"
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, preset: "custom", from: e.target.value })}
              />
              <TextField
                label="To"
                type="date"
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, preset: "custom", to: e.target.value })}
              />
            </div>
            {invalid && (
              <p role="alert" className="px-1 pt-2 text-sm text-signal">
                “To” can't be before “From”.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-2 px-1 pb-1">
              <Button variant="ghost" className="!h-8 !px-2.5" onClick={() => onChange(ALL_TIME)} disabled={!value.from && !value.to}>
                Clear dates
              </Button>
              <Button variant="primary" className="!h-8" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
