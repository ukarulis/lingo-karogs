import { describe, expect, it } from "vitest";
import {
  ARCADE_MAX_LIVES,
  ARCADE_POINTS,
  ARCADE_START_HINTS,
  ARCADE_START_LIVES,
  type ArcadeSession,
  type LingoRound,
  LingoError,
  MAX_ATTEMPTS,
  arcadeHint,
  arcadeNextWord,
  arcadeSubmit,
  createRound,
  evaluateGuess,
  fixedLetters,
  isLatvianWord,
  keyboardEvidence,
  lockedPositions,
  modeDefaults,
  normalizeRound,
  normalizeWord,
  revealLetter,
  startArcade,
  submitGuess,
} from "@/lib/lingo/engine";

const DICT = new Set(["abols", "asara", "avene", "acite", "airis", "amats", "akmens".slice(0, 5)]);

describe("normalization and validation", () => {
  it("normalizes case, whitespace and NFC", () => {
    expect(normalizeWord("  ĀBOLS ")).toBe("ābols");
    // 'a' + combining macron decomposes to 'ā'
    expect(normalizeWord("a\u0304bols")).toBe("ābols");
  });

  it("accepts valid Latvian five-letter words with diacritics", () => {
    expect(isLatvianWord("čakls")).toBe(true);
    expect(isLatvianWord("žūža")).toBe(false);
    expect(isLatvianWord("abols1")).toBe(false);
    expect(isLatvianWord("svešinieks")).toBe(false);
    expect(isLatvianWord("Rīgas")).toBe(false);
  });
});

describe("evaluateGuess", () => {
  it("marks exact matches", () => {
    expect(evaluateGuess("abols", "abols")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("marks misplaced and absent letters", () => {
    expect(evaluateGuess("alota", "abols")).toEqual([
      "correct",
      "present",
      "correct",
      "absent",
      "absent",
    ]);
  });

  it("handles duplicate letters with fewer occurrences in the answer (two-pass)", () => {
    // target has A at 0 and 4; guess has three A's
    expect(evaluateGuess("aaaba", "abcaa")).toEqual([
      "correct",
      "present",
      "absent",
      "present",
      "correct",
    ]);
    // Guess has more of a letter than the target holds.
    expect(evaluateGuess("abbab", "abcde")).toEqual([
      "correct",
      "correct",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("does not double-count a correct letter as present", () => {
    // Only one A in target, both in correct position and guessed again.
    expect(evaluateGuess("abcde", "abcde")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });
});

describe("round lifecycle", () => {
  const start = () => createRound("abols", "daily");

  it("enforces the first letter", () => {
    const round = createRound("abols", "daily", { firstLetter: "p" });
    expect(() => submitGuess(round, "asara", DICT)).toThrowError(LingoError);
    try {
      submitGuess(round, "asara", DICT);
    } catch (e) {
      expect((e as LingoError).code).toBe("wrong-first-letter");
    }
  });

  it("rejects invalid submissions without consuming an attempt", () => {
    const round = start();
    expect(() => submitGuess(round, "xyz", DICT)).toThrowError(LingoError);
    expect(() => submitGuess(round, "abolsx", DICT)).toThrowError(LingoError);
    expect(() => submitGuess(round, "akmens", new Set())).toThrowError(LingoError);
    expect(round.guesses.length).toBe(0);
    expect(round.attemptsUsed).toBe(0);
  });

  it("allows exactly five attempts and ends the round", () => {
    let round = start();
    const wrong = ["asara", "avene", "acite", "airis", "amats"];
    for (const w of wrong) {
      round = submitGuess(round, w, DICT);
    }
    expect(round.status).toBe("lost");
    expect(round.attemptsUsed).toBe(MAX_ATTEMPTS);
    expect(() => submitGuess(round, "abols", DICT)).toThrowError(LingoError);
  });

  it("rejects a duplicate word without consuming an attempt", () => {
    const round = submitGuess(start(), "asara", DICT);
    expect(() => submitGuess(round, "asara", DICT)).toThrowError(LingoError);
    try {
      submitGuess(round, "asara", DICT);
    } catch (e) {
      expect((e as LingoError).code).toBe("duplicate-word");
      expect((e as LingoError).message).toBe("Šo vārdu jau mēģināji.");
    }
    expect(round.guesses.length).toBe(1);
    expect(round.attemptsUsed).toBe(1);
    expect(round.status).toBe("playing");
  });

  it("arcade mode also rejects duplicates", () => {
    const session = startArcade("abols");
    const next = arcadeSubmit(session, "asara", DICT);
    expect(() => arcadeSubmit(next, "asara", DICT)).toThrowError(LingoError);
    expect(next.current.guesses.length).toBe(1);
  });

  it("wins on the correct word", () => {
    const round = submitGuess(start(), "abols", DICT);
    expect(round.status).toBe("won");
    expect(round.attemptsUsed).toBe(1);
  });

  it("roundtrip survives refresh (JSON serialization)", () => {
    const round = submitGuess(submitGuess(start(), "asara", DICT), "avene", DICT);
    const restored = JSON.parse(JSON.stringify(round)) as LingoRound;
    expect(restored).toEqual(round);
    const continued = submitGuess(restored, "abols", DICT);
    expect(continued.status).toBe("won");
  });
});

describe("hints and keyboard evidence", () => {
  it("reveals the leftmost unknown letter and consumes a hint", () => {
    const initial = createRound("abols", "daily");
    const { round: next, hintsLeft } = revealLetter(initial, 3);
    expect(next.revealed[1]).toBe(true);
    expect(hintsLeft).toBe(2);
    expect(() => revealLetter(next, 0)).toThrowError(LingoError);
  });

  it("does not reveal the already-known first letter", () => {
    const round = createRound("abols", "daily");
    const { round: next } = revealLetter(round, 1);
    expect(next.revealed[0]).toBe(false);
  });

  it("computes strongest keyboard evidence", () => {
    const evidence = keyboardEvidence(
      ["abols"],
      [["correct", "present", "absent", "absent", "absent"]],
    );
    expect(evidence["a"]).toBe("correct");
    expect(evidence["b"]).toBe("present");
    expect(evidence["o"]).toBe("absent");
  });
});

describe("arcade mode", () => {
  it("starts with five lives and five hints", () => {
    const s = startArcade("abols");
    expect(s.lives).toBe(ARCADE_START_LIVES);
    expect(s.hints).toBe(ARCADE_START_HINTS);
    expect(s.score).toBe(0);
  });

  it("awards points by documented formula and a life for first-guess solve", () => {
    let s: ArcadeSession = startArcade("abols");
    s = arcadeSubmit(s, "asara", DICT);
    expect(s.current.status).toBe("playing");
    s = arcadeSubmit(s, "abols", DICT);
    expect(s.score).toBe(ARCADE_POINTS[1]);
    expect(s.lives).toBe(5);
    expect(s.solved).toBe(1);

    let firstTry = startArcade("asara");
    firstTry = arcadeSubmit(firstTry, "asara", DICT);
    expect(firstTry.score).toBe(ARCADE_POINTS[0]);
    expect(firstTry.lives).toBe(6);
  });

  it("removes a life on failure and caps lives at ten", () => {
    let s: ArcadeSession = startArcade("abols");
    for (const w of ["asara", "avene", "acite", "airis", "amats"]) {
      s = arcadeSubmit(s, w, DICT);
    }
    expect(s.lives).toBe(4);
    expect(s.failed).toBe(1);

    s = { ...s, lives: ARCADE_MAX_LIVES, current: createRound("asara", "arcade") };
    s = arcadeSubmit(s, "asara", DICT);
    expect(s.lives).toBe(ARCADE_MAX_LIVES);
  });

  it("ends the session when lives reach zero", () => {
    let s: ArcadeSession = { ...startArcade("abols"), lives: 1 };
    for (const w of ["asara", "avene", "acite", "airis", "amats"]) {
      s = arcadeSubmit(s, w, DICT);
    }
    expect(s.over).toBe(true);
    expect(s.lives).toBe(0);
  });

  it("keeps hints across words and advances to the next word", () => {
    let s = arcadeHint(startArcade("abols"));
    expect(s.hints).toBe(4);
    s = arcadeSubmit(s, "abols", DICT);
    s = arcadeNextWord(s, "asara");
    expect(s.current.target).toBe("asara");
    expect(s.hints).toBe(4);
  });
});

describe("guessing policies", () => {
  it("defaults daily and endless to freeform, arcade to dictionary", () => {
    expect(modeDefaults("daily").guessPolicy).toBe("freeform");
    expect(modeDefaults("endless").guessPolicy).toBe("freeform");
    expect(modeDefaults("arcade").guessPolicy).toBe("dictionary");
    expect(modeDefaults("daily").carryConfirmedLetters).toBe(true);
    expect(modeDefaults("arcade").carryConfirmedLetters).toBe(false);
  });

  it("accepts invented freeform sequences and consumes exactly one attempt", () => {
    const round = createRound("ābols", "daily");
    const next = submitGuess(round, "ācdee", new Set());
    expect(next.guesses).toEqual(["ācdee"]);
    expect(next.attemptsUsed).toBe(1);
    expect(next.status).toBe("playing");
    expect(next.results[0]).toEqual([
      "correct",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("rejects non-dictionary words under the dictionary policy without consuming an attempt", () => {
    const round = createRound("ābols", "daily", { guessPolicy: "dictionary" });
    expect(() => submitGuess(round, "ācdee", DICT)).toThrowError(LingoError);
    try {
      submitGuess(round, "ācdee", DICT);
    } catch (e) {
      expect((e as LingoError).code).toBe("not-in-dictionary");
    }
    expect(round.guesses.length).toBe(0);
    expect(round.attemptsUsed).toBe(0);
  });

  it("still enforces the first letter under the freeform policy", () => {
    const round = createRound("ābols", "daily", { firstLetter: "p" });
    expect(() => submitGuess(round, "ācdee", new Set())).toThrowError(LingoError);
  });

  it("freeform rejects malformed input (length and alphabet) without consuming an attempt", () => {
    const round = createRound("ābols", "daily");
    expect(() => submitGuess(round, "ābol", new Set())).toThrowError(LingoError);
    expect(() => submitGuess(round, "ābols1", new Set())).toThrowError(LingoError);
    expect(round.attemptsUsed).toBe(0);
  });
});

describe("carry-forward of confirmed letters", () => {
  it("locks correctly-placed letters into subsequent rows", () => {
    let round = createRound("ābols", "daily");
    round = submitGuess(round, "ābele", DICT);
    expect(round.status).toBe("playing");
    expect(round.confirmed).toEqual([true, true, false, true, false]);
    expect(lockedPositions(round)).toEqual([true, true, false, true, false]);
    expect(fixedLetters(round)).toEqual(["ā", "b", null, "l", null]);
  });

  it("never locks yellow letters", () => {
    const round = createRound("ābols", "daily");
    const next = submitGuess(round, "ālsoa", DICT);
    expect(next.confirmed).toEqual([true, false, false, false, false]);
    expect(fixedLetters(next)[3]).toBeNull();
  });

  it("keeps earlier confirmed letters when later rows add none", () => {
    let round = createRound("ābols", "daily");
    round = submitGuess(round, "ābele", DICT); // locks positions 0, 1, 3
    round = submitGuess(round, "ābloo", DICT); // only positions 0 and 1 correct
    expect(round.confirmed).toEqual([true, true, false, true, false]);
  });

  it("can be disabled so no position is carried forward", () => {
    const round = createRound("ābols", "endless", {
      carryConfirmedLetters: false,
    });
    const next = submitGuess(round, "ābele", DICT);
    expect(next.confirmed.every((c) => !c)).toBe(true);
    expect(fixedLetters(next).slice(1).every((f) => f === null)).toBe(true);
  });
});

describe("variable word lengths", () => {
  it("creates and solves 4-, 5-, 6- and 7-letter rounds", () => {
    const cases: Array<[string, number]> = [
      ["akls", 4],
      ["ābols", 5],
      ["ābolus", 6],
      ["āboliņš", 7],
    ];
    for (const [target, len] of cases) {
      expect(isLatvianWord(target, len)).toBe(true);
      const round = createRound(target, "endless", { length: len });
      expect(round.length).toBe(len);
      expect(round.revealed).toHaveLength(len);
      expect(round.confirmed).toHaveLength(len);
      const won = submitGuess(round, target, new Set());
      expect(won.status).toBe("won");
      expect(won.attemptsUsed).toBe(1);
    }
  });

  it("rejects targets whose length does not match the config", () => {
    expect(() => createRound("ābols", "endless", { length: 6 })).toThrow();
    expect(() => createRound("ābols", "endless", { length: 3 })).toThrow();
    expect(() => createRound("ābols", "endless", { length: 8 })).toThrow();
  });

  it("evaluates words of any supported length and rejects mismatched operands", () => {
    expect(evaluateGuess("āboli", "āboli").every((c) => c === "correct")).toBe(true);
    expect(() => evaluateGuess("ābols", "ābolus")).toThrow();
  });

  it("rejects submissions after a resolved round (multiplayer-reserved status)", () => {
    const round = {
      ...createRound("ābols", "daily"),
      status: "resolved" as const,
    };
    expect(() => submitGuess(round, "ābele", DICT)).toThrowError(LingoError);
  });
});

describe("legacy save recovery", () => {
  const legacyRound = {
    mode: "daily",
    target: "ābols",
    firstLetter: "ā",
    guesses: ["ābele"],
    results: [["correct", "correct", "absent", "correct", "absent"]],
    revealed: [false, false, false, false, false],
    status: "playing",
    attemptsUsed: 1,
  };

  it("fills config fields from mode defaults", () => {
    const round = normalizeRound(legacyRound);
    expect(round).not.toBeNull();
    expect(round!.length).toBe(5);
    expect(round!.maxAttempts).toBe(5);
    expect(round!.guessPolicy).toBe("freeform");
    expect(round!.carryConfirmedLetters).toBe(true);
    expect(round!.revealFirstLetter).toBe(true);
  });

  it("derives carried letters from the last result row", () => {
    const round = normalizeRound(legacyRound)!;
    expect(round.confirmed).toEqual([true, true, false, true, false]);
    expect(fixedLetters(round)[1]).toBe("b");
  });

  it("keeps arcade saves on the dictionary policy without carry-forward", () => {
    const round = normalizeRound({ ...legacyRound, mode: "arcade" })!;
    expect(round.guessPolicy).toBe("dictionary");
    expect(round.carryConfirmedLetters).toBe(false);
    expect(round.confirmed.every((c) => !c)).toBe(true);
  });

  it("blocks further duplicates in a legacy round that already contains duplicates", () => {
    const dup = {
      ...legacyRound,
      guesses: ["ābele", "ābele"],
      results: [
        ["correct", "correct", "absent", "correct", "absent"],
        ["correct", "correct", "absent", "correct", "absent"],
      ],
      attemptsUsed: 2,
    };
    const round = normalizeRound(dup)!;
    expect(round.guesses).toHaveLength(2);
    expect(round.attemptsUsed).toBe(2);
    expect(round.status).toBe("playing");
    expect(() => submitGuess(round, "ābele", DICT)).toThrowError(LingoError);
    try {
      submitGuess(round, "ābele", DICT);
    } catch (e) {
      expect((e as LingoError).code).toBe("duplicate-word");
    }
    expect(round.guesses).toHaveLength(2);
    expect(round.attemptsUsed).toBe(2);
    expect(round.status).toBe("playing");
  });

  it("repairs inconsistent terminal statuses", () => {
    const bogus = {
      ...legacyRound,
      status: "won",
      guesses: ["ābele"],
      attemptsUsed: 1,
    };
    expect(normalizeRound(bogus)!.status).toBe("playing");
  });

  it("returns null for malformed payloads", () => {
    expect(normalizeRound(null)).toBeNull();
    expect(normalizeRound({})).toBeNull();
    expect(normalizeRound({ target: "ab" })).toBeNull();
    expect(normalizeRound({ target: "ābols", guesses: [42] })).toBeNull();
    expect(normalizeRound({ target: "ābols", guesses: [], length: 7 })).toBeNull();
  });
});
