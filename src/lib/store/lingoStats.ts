import { MAX_ATTEMPTS } from "@/lib/lingo/engine";
import { rigaDateString } from "@/lib/lingo/daily";
import { storageGet, storageSet } from "./storage";

export interface DailyEntry {
  date: string; // YYYY-MM-DD (Riga)
  word: string;
  won: boolean;
  attempts: number;
  shareGrid: string;
}

/** Per-language, per-length unlimited-game bucket. */
export interface EndlessBucket {
  total: number;
  wins: number;
  losses: number;
  distribution: number[];
  totalSolved: number;
  currentStreak: number;
  bestStreak: number;
}

export interface LingoStats {
  v: 2;
  daily: Record<string, DailyEntry>;
  /** Keyed by `${language}:${length}`, e.g. "lv:5". */
  endless: Record<string, EndlessBucket>;
  arcade: {
    sessions: number;
    bestScore: number;
    lastScore: number;
    totalWords: number;
    totalPoints: number;
    bestWordCount: number;
  };
}

export const LINGO_STATS_VERSION = 2;

export function bucketKey(language: string, length: number): string {
  return `${language}:${length}`;
}

export function emptyBucket(maxAttempts: number = MAX_ATTEMPTS): EndlessBucket {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    distribution: new Array(Math.max(1, maxAttempts)).fill(0),
    totalSolved: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function emptyLingoStats(): LingoStats {
  return {
    v: LINGO_STATS_VERSION,
    daily: {},
    endless: {},
    arcade: {
      sessions: 0,
      bestScore: 0,
      lastScore: 0,
      totalWords: 0,
      totalPoints: 0,
      bestWordCount: 0,
    },
  };
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeBucket(
  raw: unknown,
  maxAttempts: number = MAX_ATTEMPTS,
): EndlessBucket {
  const bucket = emptyBucket(maxAttempts);
  if (!raw || typeof raw !== "object") return bucket;
  const b = raw as Record<string, unknown>;
  bucket.total = num(b.total);
  bucket.wins = num(b.wins);
  bucket.losses = num(b.losses);
  bucket.totalSolved = num(b.totalSolved);
  bucket.currentStreak = num(b.currentStreak);
  bucket.bestStreak = num(b.bestStreak);
  if (Array.isArray(b.distribution)) {
    bucket.distribution = bucket.distribution.map((_, i) =>
      num((b.distribution as unknown[])[i]),
    );
  }
  return bucket;
}

function normalizeEndless(raw: unknown): Record<string, EndlessBucket> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, EndlessBucket> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    // Legacy buckets always played with five attempts.
    result[key] = normalizeBucket(value, MAX_ATTEMPTS);
  }
  return result;
}

/**
 * Migrate the V1 statistics model to V2:
 * - the single flat `endless` object becomes the "lv:5" bucket;
 * - migration is persisted immediately, making it idempotent on later loads;
 * - Daily and Arcade records are preserved as-is.
 *
 * Historical note: the V1 model counted Daily wins inside `endless`; those
 * mixed values stay in the "lv:5" bucket because they cannot be separated
 * retroactively. From V2 on, Daily and Unlimited are fully isolated.
 */
function migrate(raw: unknown): LingoStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const legacyEndless = r.endless as Record<string, unknown> | undefined;
  const legacyArcade = (r.arcade ?? {}) as Record<string, unknown>;
  const stats: LingoStats = {
    v: LINGO_STATS_VERSION,
    daily: (r.daily ?? {}) as Record<string, DailyEntry>,
    endless: {
      [bucketKey("lv", 5)]: normalizeBucket(legacyEndless),
    },
    arcade: {
      sessions: num(legacyArcade.sessions),
      bestScore: num(legacyArcade.bestScore),
      lastScore: num(legacyArcade.lastScore),
      totalWords: num(legacyArcade.totalWords),
      totalPoints: num(legacyArcade.totalPoints),
      bestWordCount: num(legacyArcade.bestWordCount),
    },
  };
  storageSet("lingoStats", stats);
  return stats;
}

export function loadLingoStats(): LingoStats {
  const raw = storageGet<unknown>("lingoStats");
  if (!raw) return emptyLingoStats();
  if ((raw as { v?: unknown }).v === LINGO_STATS_VERSION) {
    const r = raw as LingoStats;
    return {
      v: LINGO_STATS_VERSION,
      daily: r.daily ?? {},
      endless: normalizeEndless(r.endless),
      arcade: {
        sessions: num(r.arcade?.sessions),
        bestScore: num(r.arcade?.bestScore),
        lastScore: num(r.arcade?.lastScore),
        totalWords: num(r.arcade?.totalWords),
        totalPoints: num(r.arcade?.totalPoints),
        bestWordCount: num(r.arcade?.bestWordCount),
      },
    };
  }
  return migrate(raw);
}

function save(stats: LingoStats): void {
  storageSet("lingoStats", stats);
}

/** Record a Daily result. Deliberately does NOT touch Unlimited buckets. */
export function recordDaily(entry: DailyEntry): LingoStats {
  const stats = loadLingoStats();
  const next = { ...stats, daily: { ...stats.daily, [entry.date]: entry } };
  save(next);
  return next;
}

export function recordEndless(
  won: boolean,
  attempts: number,
  length: number = 5,
  language: string = "lv",
  maxAttempts: number = MAX_ATTEMPTS,
): LingoStats {
  const stats = loadLingoStats();
  const key = bucketKey(language, length);
  const bucket = stats.endless[key] ?? emptyBucket(maxAttempts);
  const next = {
    ...bucket,
    total: bucket.total + 1,
  };
  if (won) {
    next.wins += 1;
    next.totalSolved += 1;
    next.currentStreak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
    const i = Math.max(0, Math.min(maxAttempts - 1, attempts - 1));
    const distribution = [...next.distribution];
    distribution[i] += 1;
    next.distribution = distribution;
  } else {
    next.losses += 1;
    next.currentStreak = 0;
  }
  const result = {
    ...stats,
    endless: { ...stats.endless, [key]: next },
  };
  save(result);
  return result;
}

export function recordArcade(
  score: number,
  wordsSolved: number,
): LingoStats {
  const stats = loadLingoStats();
  const arcade = {
    ...stats.arcade,
    sessions: stats.arcade.sessions + 1,
    bestScore: Math.max(stats.arcade.bestScore, score),
    lastScore: score,
    totalWords: stats.arcade.totalWords + wordsSolved,
    totalPoints: stats.arcade.totalPoints + score,
    bestWordCount: Math.max(stats.arcade.bestWordCount, wordsSolved),
  };
  const next = { ...stats, arcade };
  save(next);
  return next;
}

/**
 * Daily streaks anchored to the Europe/Riga calendar (the same calendar that
 * defines the Daily puzzle itself), covering DST transitions and the hours
 * around Riga midnight.
 */
export function dailyStreaks(daily: Record<string, DailyEntry>): {
  current: number;
  best: number;
} {
  const dates = Object.keys(daily)
    .filter((d) => daily[d].won)
    .sort();
  if (dates.length === 0) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${dates[i]}T00:00:00Z`).getTime();
    if (cur - prev === 86400000) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  const now = Date.now();
  const today = rigaDateString(now);
  const yesterday = rigaDateString(now - 86400000);
  let current = 0;
  const anchor =
    dates[dates.length - 1] === today
      ? today
      : dates[dates.length - 1] === yesterday
        ? yesterday
        : null;
  if (anchor) {
    const cursor = new Date(`${anchor}T00:00:00Z`);
    while (daily[cursor.toISOString().slice(0, 10)]?.won) {
      current += 1;
      cursor.setTime(cursor.getTime() - 86400000);
    }
  }
  return { current, best: Math.max(best, current) };
}
