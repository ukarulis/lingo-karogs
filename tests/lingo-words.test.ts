import { describe, expect, it } from "vitest";
import { dictionary, guessSet, frequentTargets, targetList } from "@/lib/lingo/words";

const BLOCKED = new Set(["dirsa", "kuce", "kuča", "mauka", "pimps", "pidar", "žīds"]);

describe("word database integrity", () => {
  it("has at least 800 curated targets", () => {
    expect(targetList.length).toBeGreaterThanOrEqual(800);
    expect(dictionary.targetCount).toBe(targetList.length);
  });

  it("contains only valid normalized five-letter Latvian words", () => {
    const re = /^[a-zāčēģīķļņšūž]{5}$/;
    for (const w of targetList) {
      expect(w, `invalid target ${w}`).toMatch(re);
      expect(w).toBe(w.normalize("NFC"));
    }
  });

  it("excludes the documented blocklist", () => {
    for (const w of targetList) {
      expect(BLOCKED.has(w), `blocked word present: ${w}`).toBe(false);
    }
  });

  it("includes every target in the guess list", () => {
    for (const w of targetList) {
      expect(guessSet.has(w), `target missing from guesses: ${w}`).toBe(true);
    }
  });

  it("has a substantial frequent pool for the daily word", () => {
    expect(frequentTargets.length).toBeGreaterThanOrEqual(300);
    for (const w of frequentTargets) {
      expect(targetList).toContain(w);
    }
  });

  it("has a large guess dictionary", () => {
    expect(guessSet.size).toBeGreaterThan(10000);
  });

  it("records provenance and licenses", () => {
    expect(dictionary.license).toBe("CC BY-SA 4.0");
    expect(dictionary.sources.length).toBeGreaterThanOrEqual(3);
    for (const source of dictionary.sources) {
      expect(source.license).toBe("CC BY-SA 4.0");
    }
  });
});
