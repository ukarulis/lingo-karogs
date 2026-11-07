import { afterEach, describe, expect, it } from "vitest";
import {
  type LingoRound,
  RULESET_VERSION,
  createRound,
  evaluateSegments,
  submitGuess,
} from "@/lib/lingo/engine";
import { registerPack } from "@/lib/lingo/pack/registry";
import { latvianPack, segmentWord } from "@/lib/lingo/pack/latvian";
import type { LanguagePack } from "@/lib/lingo/pack/types";

// A deliberately different alphabet and normalization policy. "v" is a
// physical-keyboard substitute for the pack's "w", proving that validation,
// normalization and keyboard mappings come from the pack, not the engine.
const mockPack: LanguagePack = {
  id: "mock",
  locale: "xx-XX",
  displayName: "Mock",
  dictionaryVersion: "mock-1",
  ruleSetVersion: "mock-1.0",
  supportedLengths: [4, 5],
  alphabet: ["a", "b", "c", "d", "w"],
  normalizeInput: (input) =>
    input.trim().toLowerCase().normalize("NFC").replaceAll("v", "w"),
  segmentWord: (word) => [...word],
  validateCharacters: (word) =>
    [...word].every((ch) => "abcdw".includes(ch)),
  keyboardLayout: {
    rows: [
      ["a", "b", "c", "d"],
      ["w", "enter", "back"],
    ],
  },
  attribution: "test only",
  license: "test only",
};

describe("Latvian language pack", () => {
  it("normalizes case, whitespace and decomposed diacritics to NFC", () => {
    expect(latvianPack.normalizeInput("  a\u0304bols ")).toBe("ābols");
    expect(latvianPack.normalizeInput("ĀBOLS")).toBe("ābols");
  });

  it("segments into grapheme clusters", () => {
    expect(segmentWord("ābols")).toEqual(["ā", "b", "o", "l", "s"]);
    // Decomposed input is re-composed by normalization first.
    expect(
      segmentWord(latvianPack.normalizeInput("a\u0304bols")),
    ).toEqual(["ā", "b", "o", "l", "s"]);
  });

  it("validates only Latvian-alphabet letters", () => {
    expect(latvianPack.validateCharacters("ābols")).toBe(true);
    expect(latvianPack.validateCharacters("abols")).toBe(true);
    expect(latvianPack.validateCharacters("whale")).toBe(false);
    expect(latvianPack.validateCharacters("qwert")).toBe(false);
  });

  it("exposes only alphabet letters on the on-screen keyboard", () => {
    const alphabet = new Set(latvianPack.alphabet);
    for (const row of latvianPack.keyboardLayout.rows) {
      for (const key of row) {
        if (key === "enter" || key === "back") continue;
        expect(alphabet.has(key), `key ${key} in alphabet`).toBe(true);
      }
    }
    for (const letter of latvianPack.alphabet) {
      expect(
        latvianPack.keyboardLayout.rows.some((row) => row.includes(letter)),
        `alphabet letter ${letter} reachable on keyboard`,
      ).toBe(true);
    }
  });
});

describe("mock language pack proves engine extensibility", () => {
  afterEach(() => {
    // Registry is module-global; the mock must not leak between tests.
    registerPack(latvianPack);
  });

  it("creates and plays a round with a non-Latvian alphabet", () => {
    registerPack(mockPack);
    const round = createRound("abca", "endless", {
      pack: mockPack,
      length: 4,
    });
    expect(round.language).toBe("mock");
    expect(round.ruleSet).toBe(RULESET_VERSION);
    // "v" normalizes to the pack's "w"; the guess is accepted by the mock
    // alphabet but would be invalid in Latvian.
    const next = submitGuess(round, "avcw", new Set());
    expect(next.guesses).toEqual(["awcw"]);
    expect(next.attemptsUsed).toBe(1);
    expect(next.status).toBe("playing");
    expect(evaluateSegments(["w", "b", "c", "w"], ["a", "b", "c", "a"])).toEqual([
      "absent",
      "correct",
      "correct",
      "absent",
    ]);
  });

  it("rejects letters outside the pack alphabet", () => {
    registerPack(mockPack);
    const round = createRound("abca", "endless", {
      pack: mockPack,
      length: 4,
    });
    expect(() => submitGuess(round, "abcz", new Set())).toThrowError();
    expect(round.guesses).toHaveLength(0);
  });

  it("rounds persist their pack identity for later submission", () => {
    registerPack(mockPack);
    const round: LingoRound = JSON.parse(
      JSON.stringify(
        createRound("abca", "endless", { pack: mockPack, length: 4 }),
      ),
    );
    const next = submitGuess(round, "avca", new Set());
    expect(next.guesses).toEqual(["awca"]);
  });
});
