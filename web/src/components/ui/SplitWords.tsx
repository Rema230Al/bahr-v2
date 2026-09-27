import { Fragment } from "react";

/**
 * Splits text into masked words; animate `.mask-inner` with GSAP for word reveals.
 * Screen readers get the whole sentence once; the split copy is hidden from them.
 */
export default function SplitWords({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="mask">
              <span className="mask-inner">{w}</span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}
