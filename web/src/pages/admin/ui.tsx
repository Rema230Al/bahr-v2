import type { ButtonHTMLAttributes, ReactNode } from "react";
import { initials, serviceLabel } from "./format";

/** Small, calm building blocks for the admin. No magnetic or scroll effects here by design. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

const VARIANTS = {
  primary: "bg-accent text-[var(--on-accent)] hover:opacity-90",
  secondary: "border border-line bg-[var(--card)] hover:bg-ink/[0.04]",
  ghost: "hover:bg-ink/[0.06]",
};

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-[background-color,opacity] duration-200 disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-5 w-5 text-[9px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-8 w-8 text-[11px]";
  return (
    <span aria-hidden="true" className={`grid flex-none place-items-center rounded-full bg-accent/12 font-semibold text-accent ${box}`}>
      {initials(name)}
    </span>
  );
}

export function ServiceTag({ service }: { service: string }) {
  const known = ["web", "ai", "mobile"].includes(service) ? service : "other";
  return <span className={`tag tag-${known}`}>{serviceLabel(service)}</span>;
}

export function StatusBadge({ tone, children }: { tone: "accent" | "muted"; children: ReactNode }) {
  return (
    <span className={`tag ${tone === "accent" ? "tag-web" : "tag-other"}`}>
      <span className={`dot me-1.5 !h-1.5 !w-1.5 ${tone === "accent" ? "bg-accent" : "bg-muted/60"}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return <p className="text-sm text-muted">Loading…</p>;
}

/** Chevron used by the dropdown buttons and the mobile menu. */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 flex-none opacity-60 ${className}`}>
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
