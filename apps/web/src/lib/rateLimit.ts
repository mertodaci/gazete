const WINDOW_MS = 60_000;
const lastRequestAt = new Map<string, number>();

export function isHoneypotTripped(honeypotValue: string | undefined): boolean {
  return Boolean(honeypotValue && honeypotValue.length > 0);
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = lastRequestAt.get(ip);
  lastRequestAt.set(ip, now);
  if (last === undefined) return true;
  return now - last > WINDOW_MS;
}
