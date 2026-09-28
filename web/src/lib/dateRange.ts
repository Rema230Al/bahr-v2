import type { DateRange } from "./api";

/** Admin date range: presets resolve to inclusive local YYYY-MM-DD bounds. */
export type Preset = "all" | "today" | "7d" | "month" | "30d" | "custom";
export type RangeState = DateRange & { preset: Preset };

export const ALL_TIME: RangeState = { preset: "all", from: "", to: "" };

const iso = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

export function presetRange(p: Preset, current: RangeState): RangeState {
  const today = iso(new Date());
  const now = new Date();
  switch (p) {
    case "all":
      return ALL_TIME;
    case "today":
      return { preset: p, from: today, to: today };
    case "7d":
      return { preset: p, from: daysAgo(6), to: today };
    case "month":
      return { preset: p, from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "30d":
      return { preset: p, from: daysAgo(29), to: today };
    case "custom":
      return { ...current, preset: p };
  }
}

export const isValidRange = (r: DateRange) => !(r.from && r.to && r.to < r.from);

/** The range the lists should load: only a valid one, otherwise nothing is filtered yet. */
export const appliedRange = (r: RangeState): DateRange => (isValidRange(r) ? { from: r.from, to: r.to } : { from: "", to: "" });
