import { LOGO_BODY, LOGO_STROKE, LOGO_VIEWBOX } from "../../lib/logo";

/** Bahr's blue calligraphic mark. Colour follows --nav-logo so it deepens with the dive. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      className={`h-[30px] w-auto transition-colors duration-500 ${className}`}
      style={{ fill: "var(--nav-logo)" }}
      aria-hidden="true"
    >
      <path d={LOGO_BODY} />
      <path d={LOGO_STROKE} />
    </svg>
  );
}
