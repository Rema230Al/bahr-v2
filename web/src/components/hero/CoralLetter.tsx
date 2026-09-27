import { useLayoutEffect, useRef, useState } from "react";

/**
 * Bahr's small coral detail on one letter. Wrapping the letter in its own <span> would break
 * Arabic shaping (the letter would disconnect from its word), so instead the whole word is drawn
 * twice and the coral copy is clipped to that single letter's box, measured from the real layout.
 */
export default function CoralLetter({ word, index }: { word: string; index: number }) {
  const base = useRef<HTMLSpanElement>(null);
  const [clip, setClip] = useState<string>("inset(0 100% 0 0)");

  useLayoutEffect(() => {
    const el = base.current;
    const text = el?.firstChild;
    if (!el || !text || index >= word.length) return;
    const measure = () => {
      const range = document.createRange();
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const r = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const left = Math.max(0, r.left - box.left);
      const right = Math.max(0, box.right - r.right);
      setClip(`inset(-20% ${right}px -20% ${left}px)`);
    };
    measure();
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [word, index]);

  return (
    <span className="relative inline-block">
      <span ref={base}>{word}</span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 text-[#ff846a]" style={{ clipPath: clip }}>
        {word}
      </span>
    </span>
  );
}
