import { describe, expect, it } from "vitest";
import {
  type DailyEntry,
  type LingoStats,
  dailyStreaks,
  emptyLingoStats,
  recordDaily,
  recordEndless,
} from "@/lib/store/lingoStats";
import { karogsAggregates, loadKarogsStats } from "@/lib/store/karogsStats";
import { ACHIEVEMENTS, recordGameEvent } from "@/lib/store/achievements";
import { clearGuestData } from "@/lib/store/storage";
import { beforeEach } from "vitest";

beforeEach(() => {
  clearGuestData();
});

describe("lingo statistics", () => {
  it("accumulates endless wins, losses and streaks", () => {
    let stats: LingoStats = emptyLingoStats();
    stats = recordEndless(true, 3);
    stats = recordEndless(true, 2);
    stats = recordEndless(false, 5);
    expect(stats.endless.wins).toBe(2);
    expect(stats.endless.losses).toBe(1);
    expect(stats.endless.currentStreak).toBe(0);
    expect(stats.endless.bestStreak).toBe(2);
    expect(stats.endless.distribution[2]).toBe(1);
    expect(stats.endless.distribution[1]).toBe(1);
  });

  it("records daily results without double counting", () => {
    let stats = recordDaily({
      date: "2026-11-05",
      word: "abols",
      won: true,
      attempts: 3,
      shareGrid: "x",
    });
    stats = recordDaily({
      date: "2026-11-05",
      word: "abols",
      won: true,
      attempts: 3,
      shareGrid: "x",
    });
    expect(stats.endless.wins).toBe(1);
  });

  it("computes current and best daily streaks", () => {
    const daily: Record<string, DailyEntry> = {};
    const mk = (date: string, won: boolean): DailyEntry => ({
      date,
      word: "abols",
      won,
      attempts: 3,
      shareGrid: "",
    });
    const today = new Date();
    const d = (offset: number) =>
      new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);
    daily[d(0)] = mk(d(0), true);
    daily[d(1)] = mk(d(1), true);
    daily[d(2)] = mk(d(2), false);
    daily[d(3)] = mk(d(3), true);
    daily[d(4)] = mk(d(4), true);
    const { current, best } = dailyStreaks(daily);
    expect(current).toBe(2);
    expect(best).toBe(2);
  });
});

describe("karogs aggregates", () => {
  it("computes wins, rates and special events", () => {
    const stats = loadKarogsStats();
    stats.entries.length = 0;
    const base = {
      id: "1",
      result: "win" as const,
      moves: 40,
      durationSec: 300,
      flagCaptured: true,
      spyKilledMarshal: false,
      bombDefused: false,
      date: new Date().toISOString(),
    };
    stats.entries.push({ ...base, opponent: "ai-hard" });
    stats.entries.push({
      ...base,
      id: "2",
      result: "loss",
      opponent: "ai-easy",
      durationSec: 200,
      flagCaptured: false,
    });
    stats.entries.push({
      ...base,
      id: "3",
      result: "draw",
      opponent: "online",
      durationSec: 400,
      flagCaptured: false,
      spyKilledMarshal: true,
      bombDefused: true,
    });
    const a = karogsAggregates(stats);
    expect(a.games).toBe(3);
    expect(a.wins).toBe(1);
    expect(a.draws).toBe(1);
    expect(a.flagsCaptured).toBe(1);
    expect(a.spyKills).toBe(1);
    expect(a.defusals).toBe(1);
    expect(a.byOpponent["ai-hard"].wins).toBe(1);
    expect(a.avgDurationSec).toBe(300);
  });
});

describe("achievements", () => {
  it("defines meaningful achievements for both games", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(9);
    expect(ACHIEVEMENTS.map((a) => a.id)).toContain("karogs-hard-ai");
    expect(ACHIEVEMENTS.map((a) => a.id)).toContain("karogs-spy");
  });

  it("unlocks only on validated events", () => {
    expect(recordGameEvent({ kind: "lingo-won", attempts: 1, mode: "daily" })).toEqual([
      "lingo-first-win",
      "lingo-first-try",
    ]);
    expect(recordGameEvent({ kind: "karogs-won", opponent: "ai-hard" })).toEqual([
      "karogs-first-win",
      "karogs-hard-ai",
    ]);
  });
});
