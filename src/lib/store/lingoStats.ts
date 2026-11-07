import { MAX_ATTEMPTS } from "@/lib/lingo/engine";
import { storageGet, storageSet } from "./storage";

export interface DailyEntry {
  date: string; // YYYY-MM-DD (Riga)
  word: string;
  won: boolean;
  attempts: number;
  shareGrid: string;
}

export interface LingoStats {
  daily: Record<string, DailyEntry>;
  endless: {
    total: number;
    wins: number;
    losses: number;
    distribution: [number, number, number, number, number];
    totalSolved: number;
    currentStreak: number;
    bestStreak: number;
  };
  arcade: {
    sessions: number;
    bestScore: number;
    lastScore: number;
    totalWords: number;
    totalPoints: number;
    bestWordCount: number;
  };
}

export function emptyLingoStats(): LingoStats {
  return {
    daily: {},
    endless: {
      total: 0,
      wins: 0,
      losses: 0,
      distribution: [0, 0, 0, 0, 0],
      totalSolved: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
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

export function loadLingoStats(): LingoStats {
  const raw = storageGet<LingoStats>("lingoStats");
  if (!raw) return emptyLingoStats();
  return {
    ...emptyLingoStats(),
    ...raw,
    daily: raw.daily ?? {},
    endless: { ...emptyLingoStats().endless, ...(raw.endless ?? {}) },
    arcade: { ...emptyLingoStats().arcade, ...(raw.arcade ?? {}) },
  };
}

function save(stats: LingoStats): void {
  storageSet("lingoStats", stats);
}

export function recordDaily(entry: DailyEntry): LingoStats {
  const stats = loadLingoStats();
  const previous = stats.daily[entry.date];
  const next = { ...stats, daily: { ...stats.daily, [entry.date]: entry } };
  // Winning again on the same day must not double-count.
  if (!previous?.won && entry.won) {
    next.endless = {
      ...next.endless,
      wins: next.endless.wins + 1,
      distribution: next.endless.distribution.map((n, i) =>
        i === entry.attempts - 1 ? n + 1 : n,
      ) as LingoStats["endless"]["distribution"],
      totalSolved: next.endless.totalSolved + 1,
    };
  }
  save(next);
  return next;
}

export function recordEndless(won: boolean, attempts: number): LingoStats {
  const stats = loadLingoStats();
  const endless = { ...stats.endless };
  endless.total += 1;
  if (won) {
    endless.wins += 1;
    endless.totalSolved += 1;
    endless.currentStreak += 1;
    endless.bestStreak = Math.max(endless.bestStreak, endless.currentStreak);
    const i = Math.max(0, Math.min(MAX_ATTEMPTS - 1, attempts - 1));
    const distribution = [...endless.distribution] as LingoStats["endless"]["distribution"];
    distribution[i] += 1;
    endless.distribution = distribution;
  } else {
    endless.losses += 1;
    endless.currentStreak = 0;
  }
  const next = { ...stats, endless };
  save(next);
  return next;
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
    const prev = new Date(dates[i - 1]).getTime();
    const cur = new Date(dates[i]).getTime();
    if (cur - prev === 86400000) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  // Current streak counts back from the latest win if it is today or yesterday.
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  let current = 0;
  const anchor =
    dates[dates.length - 1] === todayStr
      ? todayStr
      : dates[dates.length - 1] === yesterday
        ? yesterday
        : null;
  if (anchor) {
    const cursor = new Date(anchor);
    while (daily[cursor.toISOString().slice(0, 10)]?.won) {
      current += 1;
      cursor.setTime(cursor.getTime() - 86400000);
    }
  }
  return { current, best: Math.max(best, current) };
}
