import { describe, expect, it } from "vitest";
import {
  dictionaryManifest,
  enabledLengths,
  getGuessSet,
  isLengthEnabled,
  loadPool,
  pickTargetFrom,
  type WordPool,
} from "@/lib/lingo/pools";

describe("dictionary manifest", () => {
  it("exposes all four validated lengths", () => {
    expect(dictionaryManifest.id).toBe("lv");
    expect(dictionaryManifest.ruleSetVersion).toBe("lingo-2.0");
    expect(enabledLengths()).toEqual([4, 5, 6, 7]);
    expect(isLengthEnabled(8)).toBe(false);
  });
});

describe("word pools", () => {
  it("loads non-empty, quality-gated pools for every enabled length", async () => {
    for (const length of enabledLengths()) {
      const pool = await loadPool(length);
      expect(pool, `pool for ${length}`).not.toBeNull();
      expect(pool!.targets.length).toBeGreaterThanOrEqual(400);
      expect(pool!.frequent.length).toBeGreaterThanOrEqual(100);
      expect(pool!.guesses.length).toBeGreaterThanOrEqual(1000);
      expect(pool!.frequent.length).toBeLessThanOrEqual(pool!.targets.length);
      for (const target of pool!.targets) {
        expect(target).toHaveLength(length);
      }
      for (const frequent of pool!.frequent.slice(0, 50)) {
        expect(pool!.targets).toContain(frequent);
      }
      const guesses = new Set(pool!.guesses);
      for (const target of pool!.targets.slice(0, 50)) {
        expect(guesses.has(target), `${target} in guesses`).toBe(true);
      }
      expect(pool!.license).toBe("CC BY-SA 4.0");
      expect(pool!.sources.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("refuses disabled or unknown lengths", async () => {
    expect(await loadPool(8)).toBeNull();
    expect(await loadPool(3)).toBeNull();
    expect(await getGuessSet(8)).toBeNull();
  });

  it("caches pools and guess sets", async () => {
    const a = await loadPool(4);
    const b = await loadPool(4);
    expect(a).toBe(b);
    const s1 = await getGuessSet(4);
    const s2 = await getGuessSet(4);
    expect(s1).toBe(s2);
  });

  it("picks targets avoiding recent words", () => {
    const pool = {
      targets: ["abols", "asara", "avene"],
      frequent: [],
      guesses: [],
    } as unknown as WordPool;
    const avoid = new Set(["abols", "asara"]);
    expect(pickTargetFrom(pool, () => 0, avoid)).toBe("avene");
    // When everything is avoided, it falls back to the full pool.
    expect(pickTargetFrom(pool, () => 0, new Set(pool.targets))).toBe("abols");
  });
});
