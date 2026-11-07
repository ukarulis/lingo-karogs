import { describe, expect, it } from "vitest";
import {
  type DailyEntry,
  type LingoStats,
  dailyStreaks,
  emptyLingoStats,
  loadLingoStats,
  recordDaily,
  recordEndless,
} from "@/lib/store/lingoStats";
import { karogsAggregates, loadKarogsStats } from "@/lib/store/karogsStats";
import { ACHIEVEMENTS, recordGameEvent } from "@/lib/store/achievements";
import { clearGuestData, storageSet } from "@/lib/store/storage";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  clearGuestData();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lingo statistics", () => {
  it("accumulates endless wins, losses and streaks", () => {
    let stats: LingoStats = emptyLingoStats();
    stats = recordEndless(true, 3, 5);
    stats = recordEndless(true, 2, 5);
    stats = recordEndless(false, 5, 5);
    const bucket = stats.endless["lv:5"];
    expect(bucket.wins).toBe(2);
    expect(bucket.losses).toBe(1);
    expect(bucket.currentStreak).toBe(0);
    expect(bucket.bestStreak).toBe(2);
    expect(bucket.distribution[2]).toBe(1);
    expect(bucket.distribution[1]).toBe(1);
  });

  it("keeps word lengths in separate buckets", () => {
    let stats = recordEndless(true, 2, 4);
    stats = recordEndless(true, 1, 7);
    expect(stats.endless["lv:4"].total).toBe(1);
    expect(stats.endless["lv:7"].total).toBe(1);
    expect(stats.endless["lv:5"]).toBeUndefined();
  });

  it("records daily results without touching endless buckets", () => {
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
    expect(Object.keys(stats.daily)).toHaveLength(1);
    expect(Object.keys(stats.endless)).toHaveLength(0);
    expect(stats.daily["2026-11-05"].won).toBe(true);
    expect(stats.daily["2026-11-05"].attempts).toBe(3);
  });

  it("migrates V1 stats into the lv:5 bucket exactly once", () => {
    storageSet("lingoStats", {
      daily: { "2026-11-01": { date: "2026-11-01", word: "abols", won: true, attempts: 3, shareGrid: "x" } },
      endless: {
        total: 7,
        wins: 3,
        losses: 4,
        distribution: [1, 1, 1, 0, 0],
        totalSolved: 3,
        currentStreak: 1,
        bestStreak: 2,
      },
      arcade: { sessions: 2, bestScore: 900, lastScore: 500, totalWords: 4, totalPoints: 1400, bestWordCount: 3 },
    });
    const migrated = loadLingoStats();
    expect(migrated.v).toBe(2);
    expect(migrated.endless["lv:5"].total).toBe(7);
    expect(migrated.endless["lv:5"].wins).toBe(3);
    expect(migrated.endless["lv:5"].distribution[2]).toBe(1);
    expect(migrated.daily["2026-11-01"].won).toBe(true);
    expect(migrated.arcade.sessions).toBe(2);
    // Loading again must not double-count.
    const again = loadLingoStats();
    expect(again.endless["lv:5"].total).toBe(7);
  });

  it("computes current and best daily streaks on the Riga calendar", () => {
    vi.useFakeTimers();
    // 21:30Z is 23:30 in Riga (UTC+2): still 2026-11-07 in Riga.
    vi.setSystemTime(new Date("2026-11-07T21:30:00Z"));
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

  it("anchors streaks to Riga dates across DST and midnight", () => {
    vi.useFakeTimers();
    // Riga DST switch night: 21:30Z on 2026-03-29 is 00:30 on 2026-03-30 in
    // Riga (UTC+3). The UTC-derived date would incorrectly be 2026-03-29.
    vi.setSystemTime(new Date("2026-03-29T21:30:00Z"));
    const daily: Record<string, DailyEntry> = {
      "2026-03-30": { date: "2026-03-30", word: "abols", won: true, attempts: 3, shareGrid: "" },
      "2026-03-29": { date: "2026-03-29", word: "abols", won: true, attempts: 2, shareGrid: "" },
    };
    const { current } = dailyStreaks(daily);
    expect(current).toBe(2);
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
