const WINDOW_MS = 60_000;

// In-process only: this Map lives in a single Next.js server instance's memory,
// so the limit is per-instance and resets on restart. That is acceptable at this
// project's stated scale (one container behind one nginx); a multi-instance
// deployment would need a shared store (Redis, or a Postgres table) instead.
const lastRequestAt = new Map<string, number>();

export function isHoneypotTripped(honeypotValue: string | undefined): boolean {
  return Boolean(honeypotValue && honeypotValue.length > 0);
}

// Drop entries that are already outside the window: they can no longer block
// anything, and keeping them would let the Map grow without bound (a memory
// exhaustion vector if an attacker cycles through many distinct keys).
function evictExpired(now: number): void {
  // forEach rather than for...of: apps/web's tsconfig target predates
  // downlevelIteration-free Map iteration. Deleting the current entry during
  // Map.forEach is well-defined.
  lastRequestAt.forEach((timestamp, key) => {
    if (now - timestamp > WINDOW_MS) lastRequestAt.delete(key);
  });
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  evictExpired(now);
  const last = lastRequestAt.get(ip);
  lastRequestAt.set(ip, now);
  if (last === undefined) return true;
  return now - last > WINDOW_MS;
}
