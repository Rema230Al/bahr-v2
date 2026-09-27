import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { gsap } from "../../lib/gsap";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; strength?: number };

/** Pill button with a gentle magnetic pull toward the pointer (mouse only). */
export default function MagneticButton({ children, className = "", strength = 0.25, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    gsap.to(ref.current, {
      x: (e.clientX - (b.left + b.width / 2)) * strength,
      y: (e.clientY - (b.top + b.height / 2)) * strength,
      duration: 0.6,
      ease: "power3.out",
    });
  };
  const onLeave = () => gsap.to(ref.current, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" });

  return (
    <button
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-flex min-h-11 items-center justify-center gap-3 rounded-full border border-current/30 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-500 hover:border-current/70 hover:bg-current/[0.06] disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
