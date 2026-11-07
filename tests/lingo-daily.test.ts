import { describe, expect, it } from "vitest";
import {
  dailyTarget,
  nextRigaMidnight,
  rigaDateString,
} from "@/lib/lingo/daily";
import { frequentTargets, targetList } from "@/lib/lingo/words";

describe("Riga calendar", () => {
  it("computes the Riga date across DST", () => {
    // Winter: UTC+2
    expect(rigaDateString(new Date("2026-01-15T21:30:00Z"))).toBe("2026-01-15");
    // Summer: UTC+3 — 21:30Z is already next day in Riga
    expect(rigaDateString(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-16");
    expect(rigaDateString(new Date("2026-07-15T19:30:00Z"))).toBe("2026-07-15");
  });

  it("returns a next midnight within 26 hours and on the next day", () => {
    const base = Date.parse("2026-03-29T00:00:00Z"); // DST switch day in Riga
    const next = nextRigaMidnight(base);
    expect(next).toBeGreaterThan(base);
    expect(next - base).toBeLessThanOrEqual(26 * 3600 * 1000);
    expect(rigaDateString(next)).not.toBe(rigaDateString(base));
  });

  it("selects a stable daily target from the frequent pool", () => {
    const a = dailyTarget("2026-11-07", frequentTargets);
    const b = dailyTarget("2026-11-07", frequentTargets);
    expect(a).toBe(b);
    expect(frequentTargets).toContain(a);
    expect(targetList).toContain(a);
  });

  it("falls back to the full target list when the daily pool is empty", () => {
    expect(() => dailyTarget("2026-11-07", [])).toThrow();
  });
});
