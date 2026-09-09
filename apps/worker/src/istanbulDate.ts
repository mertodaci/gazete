// Europe/Istanbul is a fixed UTC+3 offset year-round (Turkey abolished DST in
// 2016), so the Istanbul calendar date is obtained by shifting the current
// instant forward 3 hours and then truncating to midnight UTC. Truncating in
// plain UTC instead would stamp stories created between 00:00 and 03:00
// Istanbul time with *yesterday's* digestDate — after yesterday's digest had
// already gone out — so those stories would never be delivered to anyone.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function istanbulToday(now: number = Date.now()): Date {
  const shifted = new Date(now + ISTANBUL_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}
