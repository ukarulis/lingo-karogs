// Deterministic daily word selection, anchored to the Europe/Riga calendar.

const RIGA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Riga",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function rigaDateString(now: Date | number = Date.now()): string {
  return RIGA_DATE.format(new Date(now)); // YYYY-MM-DD
}

export function dayIndex(dateString: string): number {
  const [y, m, d] = dateString.split("-").map(Number);
  const utc = Date.UTC(y, (m ?? 1) - 1, d);
  return Math.floor(utc / 86400000);
}

export function dailyTarget(
  dateString: string,
  pool: readonly string[],
): string {
  if (pool.length === 0) {
    throw new Error("Daily word pool is empty");
  }
  // FNV-1a of the date keeps selection stable and uniform.
  let hash = 0x811c9dc5;
  const s = dateString;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return pool[Math.abs(hash) % pool.length];
}

/** Timestamp of the next midnight in Europe/Riga (DST-safe). */
export function nextRigaMidnight(now: number = Date.now()): number {
  const today = rigaDateString(now);
  let t = now;
  for (let i = 0; i < 30; i++) {
    t += 60 * 60 * 1000;
    if (rigaDateString(t) !== today) {
      return t - (t % (60 * 60 * 1000));
    }
  }
  return now + 24 * 60 * 60 * 1000;
}

export function formatDateLv(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return `${d}.${m}.${y}`;
}
