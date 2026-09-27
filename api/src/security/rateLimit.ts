/**
 * Fixed-window, in-memory rate limiter. Fine for a single Fly machine; move to Redis/Upstash
 * if the API is ever scaled horizontally.
 */
export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = now();

  return {
    /** Records one hit for `key`; throws RateLimitError once the window's budget is spent. */
    hit(key: string) {
      const t = now();
      if (t - lastSweep > windowMs) {
        for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
        lastSweep = t;
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return;
      }
      entry.count++;
      if (entry.count > max) throw new RateLimitError(Math.ceil((entry.resetAt - t) / 1000));
    },
    reset: () => hits.clear(),
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
