import type { Lead } from "../../lib/api";

/** Display helpers shared by the admin views. */
export const SERVICES: [string, string][] = [
  ["web", "Web"],
  ["ai", "AI"],
  ["mobile", "Mobile"],
  ["other", "Other"],
];
export const serviceLabel = (s: string) => SERVICES.find(([v]) => v === s)?.[1] ?? s;

const BUDGETS: Record<string, string> = {
  "under-50k": "Under 50k SAR",
  "50k-150k": "50k–150k SAR",
  "150k-500k": "150k–500k SAR",
  "500k-plus": "500k+ SAR",
  "not-sure": "Budget not sure",
};
export const budgetLabel = (b: string) => BUDGETS[b] ?? b;

export const sar = (n: number) => `SAR ${n.toLocaleString("en-US")}`;
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
export const isOverdue = (l: Lead) => !!l.followUpOn && l.followUpOn < today() && l.stage !== "won" && l.stage !== "lost";
export const ownerName = (email: string | null) => (email ? email.split("@")[0]! : "Unassigned");

/** "Faisal Al-Otaibi" → "FA"; an email uses the part before @. */
export function initials(name: string) {
  const words = name.split("@")[0]!.split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[words.length - 1]![0]] : [words[0]?.[0], words[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}
