import { SelectField, TextField } from "../components/ui/Field";
import { ALL_TIME, isValidRange, presetRange, type Preset, type RangeState } from "../lib/dateRange";

/**
 * Date range filter shared by every admin list. The Dashboard owns the value, so the range
 * survives switching tabs. Presets just fill in From/To; editing a date switches to Custom.
 * The server re-validates everything (real dates, To ≥ From).
 */
const PRESETS: [Preset, string][] = [
  ["all", "All time"],
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["month", "This month"],
  ["30d", "Last 30 days"],
  ["custom", "Custom range"],
];

const pretty = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function DateRangeFilter({ value, onChange }: { value: RangeState; onChange: (r: RangeState) => void }) {
  const invalid = !isValidRange(value);
  const active = value.from || value.to;

  return (
    <div role="group" aria-labelledby="date-range-title" className="border-b border-line pb-6">
      <h2 id="date-range-title" className="sr-only">
        Date range
      </h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <SelectField
          label="Created"
          value={value.preset}
          onChange={(e) => onChange(presetRange(e.target.value as Preset, value))}
          options={PRESETS}
        />
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
          error={invalid ? "“To” can't be before “From”" : undefined}
        />
        <button
          type="button"
          onClick={() => onChange(ALL_TIME)}
          disabled={!active}
          className="link-underline label justify-self-start !opacity-100 disabled:!opacity-40 lg:mt-9"
        >
          Clear dates
        </button>
      </div>
      <p role="status" className="label mt-4">
        {invalid
          ? "Fix the dates to apply the filter."
          : active
            ? `Showing items created ${value.from ? pretty(value.from) : "any time"} – ${value.to ? pretty(value.to) : "today"}`
            : "Showing all dates"}
      </p>
    </div>
  );
}
