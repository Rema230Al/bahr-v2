import { usePrefs } from "../../i18n/PrefsProvider";
import { MOODS } from "../../lib/journey";

/** The hero's wave: two wavelengths per half-width, so sliding it by -50% loops seamlessly. */
const WAVE_PATH = "M0 20 Q 180 0 360 20 T 720 20 T 1080 20 T 1440 20 T 1800 20 T 2160 20 T 2520 20 T 2880 20 V40 H0Z";

/** The wave-shaped top edge of a body of water. Shared by the hero and the admin pages. */
export function WaveEdge({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={`absolute left-0 w-[200%] ${className}`} viewBox="0 0 2880 40" preserveAspectRatio="none">
      <path d={WAVE_PATH} fill={color} />
    </svg>
  );
}

/**
 * A calm sea along the bottom of a page: the hero's wave in the hero's colour, taller, in two
 * slow layers. It occupies its own band — pages reserve the same space as bottom padding
 * (see SEA_PADDING) so content never sits on top of the water.
 */
export default function SeaWaves() {
  const { theme } = usePrefs();
  const color = MOODS[theme].bg[1];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[38svh] overflow-x-clip">
      {/* back layer: the same wave, softer and slower, for a little depth */}
      <div className="absolute inset-x-0 bottom-0 h-[calc(100%-4px)] opacity-45">
        <WaveEdge color={color} className="sea-wave-slow -top-[54px] h-14" />
        <div className="h-full" style={{ background: color }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[calc(100%-44px)]">
        <WaveEdge color={color} className="sea-wave -top-[54px] h-14" />
        <div className="h-full" style={{ background: color }} />
      </div>
    </div>
  );
}

/** Bottom padding that keeps page content above the sea (38svh band + breathing room). */
export const SEA_PADDING = "pb-[calc(38svh+3rem)]";
