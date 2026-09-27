/**
 * Bahr's calligraphic mark (from bybahr.com), split in two: the flowing body of "بحر" and the
 * tall vertical stroke. The stroke is kept separate so it can stretch into the dive line.
 */
export const LOGO_VIEWBOX = "93.298654 3.955098 53.004055 46.444903";
export const LOGO_ASPECT = 53.004055 / 46.444903;

export const LOGO_BODY =
  "m136.3 5.4c0.7 0.8-2.6 7.2-3 8.6-0.3 0.4-1.3 0.8-1.3-0.3s0-1.8-1.8-2.1c-3.9-0.7-7 1.3-7.9 4.3-0.3 1 8.9 2.7 9.1 4.5 0.2 1.9-1.5 8.8-3.4 10.3-3.2 2.4-9 3.2-14.4 3.7-1.6 0.1-1.7 1.5-2.2 2.4-2 4-4.7 8.2-10.2 7.9-2.5-0.1-8-2-7.9-3.1 0-0.7 2.4-1 6-2.3 4.8-1.6 10.3-3.8 10.8-4.5l2.7-5.1c1.1-2.1 1.9-2.2 5.7-2.6 2.7-0.2 8.3-0.9 8.3-1.7s-3.8-1.9-7.7-2.7c-1.6-0.3-1.1-0.7 0.9-6 0.5-1.2 2.5-5.6 3-6.9 2-3.9 4.7-6.2 9-5.8 1.5 0.1 3.7 0.3 4.3 1.4zm-0.5 10.6c0.6 0 2.9 3.4 2.7 4.2-0.1 0.3-2.8 2.3-3.5 2.3s-3.1-2.7-3.1-3.6c0-0.8 3.1-2.9 3.9-2.9z";

export const LOGO_STROKE =
  "m146.3 8.3v41.4c0 0.5-0.1 0.7-1.4 0.7-1.9 0-1.8-0.3-1.9-1.9-0.2-3.2 0.2-39.5 0.3-40.1 0.4-1 3.1-0.9 3-0.1z";

/** Where the vertical stroke sits inside the logo box, as fractions of its width/height (measured with getBBox). */
export const STROKE_BOX = { cx: 0.9683, top: 0.0801, bottom: 1, width: 0.0634 };
