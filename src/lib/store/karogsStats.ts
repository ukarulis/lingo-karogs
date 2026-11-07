import { storageGet, storageSet } from "./storage";

export type KarogsOpponent =
  | "ai-easy"
  | "ai-medium"
  | "ai-hard"
  | "local-human"
  | "online";

export interface KarogsGameEntry {
  id: string;
  opponent: KarogsOpponent;
  result: "win" | "loss" | "draw";
  moves: number;
  durationSec: number;
  flagCaptured: boolean;
  spyKilledMarshal: boolean;
  bombDefused: boolean;
  date: string;
}

export interface KarogsStats {
  entries: KarogsGameEntry[];
}

const MAX_ENTRIES = 250;

export function loadKarogsStats(): KarogsStats {
  return { entries: storageGet<KarogsGameEntry[]>("karogsStats") ?? [] };
}

export function recordKarogsGame(entry: KarogsGameEntry): KarogsStats {
  const stats = loadKarogsStats();
  const entries = [entry, ...stats.entries].slice(0, MAX_ENTRIES);
  storageSet("karogsStats", entries);
  return { entries };
}

export interface KarogsAggregates {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  byOpponent: Record<KarogsOpponent, { games: number; wins: number }>;
  avgDurationSec: number;
  fastestWinSec: number | null;
  currentStreak: number;
  bestStreak: number;
  flagsCaptured: number;
  spyKills: number;
  defusals: number;
}

export function karogsAggregates(stats: KarogsStats): KarogsAggregates {
  const entries = stats.entries;
  const byOpponent: KarogsAggregates["byOpponent"] = {
    "ai-easy": { games: 0, wins: 0 },
    "ai-medium": { games: 0, wins: 0 },
    "ai-hard": { games: 0, wins: 0 },
    "local-human": { games: 0, wins: 0 },
    online: { games: 0, wins: 0 },
  };
  for (const e of entries) {
    byOpponent[e.opponent].games += 1;
    if (e.result === "win") byOpponent[e.opponent].wins += 1;
  }
  const wins = entries.filter((e) => e.result === "win");
  const durations = entries.filter((e) => e.durationSec > 0);
  let current = 0;
  let best = 0;
  for (const e of entries) {
    if (e.result === "win") {
      current += 1;
      best = Math.max(best, current);
    } else if (e.result === "loss") {
      current = 0;
    }
  }
  return {
    games: entries.length,
    wins: wins.length,
    losses: entries.filter((e) => e.result === "loss").length,
    draws: entries.filter((e) => e.result === "draw").length,
    winRate: entries.length ? Math.round((wins.length / entries.length) * 100) : 0,
    byOpponent,
    avgDurationSec: durations.length
      ? Math.round(durations.reduce((a, e) => a + e.durationSec, 0) / durations.length)
      : 0,
    fastestWinSec: wins.length ? Math.min(...wins.map((e) => e.durationSec || Infinity)).toString() === "Infinity" ? null : Math.min(...wins.map((e) => e.durationSec || Infinity)) : null,
    currentStreak: current,
    bestStreak: best,
    flagsCaptured: entries.filter((e) => e.flagCaptured).length,
    spyKills: entries.filter((e) => e.spyKilledMarshal).length,
    defusals: entries.filter((e) => e.bombDefused).length,
  };
}
