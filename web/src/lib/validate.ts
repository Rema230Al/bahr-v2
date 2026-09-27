import type { Copy } from "../i18n/content";

/** Client-side checks that mirror the server's rules — for fast feedback only; the server is the authority. */
export type Rule = { min?: number; max?: number; email?: boolean; url?: boolean; optional?: boolean };

export function validate(values: Record<string, string>, rules: Record<string, Rule>, e: Copy["errors"]) {
  const errors: Record<string, string> = {};
  for (const [k, r] of Object.entries(rules)) {
    const v = (values[k] ?? "").trim();
    if (!v) {
      if (!r.optional) errors[k] = e.required;
      continue;
    }
    if (r.min && v.length < r.min) errors[k] = e.short(r.min);
    else if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[k] = e.email;
    else if (r.url && !/^https?:\/\/\S+$/.test(v)) errors[k] = e.url;
  }
  return errors;
}

export function trimAll(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
}

/** Maps an API error code (rate_limited, already_applied, …) to friendly copy. */
export function errorMessage(code: string, e: Copy["errors"]) {
  const m = (e as Record<string, unknown>)[code];
  return typeof m === "string" ? m : e.generic;
}
