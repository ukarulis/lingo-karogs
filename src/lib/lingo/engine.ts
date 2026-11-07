// Pure, framework-free Lingo game engine. State is plain JSON-safe data;
// every mutation returns a new state object.
//
// The core is driven by an explicit `LingoConfig` carried on every round, so
// word length, attempt count, guessing policy, first-letter revelation and
// confirmed-letter carry-forward are rules, not hardcoded assumptions.

import type { LanguagePack } from "./pack/types";
import { resolvePack } from "./pack/registry";

export type CellStatus = "correct" | "present" | "absent";
/**
 * Solo rounds end in `won` or `lost`. `resolved` is reserved for server-
 * adjudicated multiplayer rounds, where the final disposition is determined
 * by the match service rather than a local submit call.
 */
export type RoundStatus = "playing" | "won" | "lost" | "resolved";
export type LingoMode = "daily" | "endless" | "arcade";
export type GuessPolicy = "freeform" | "dictionary";

/** Legacy constants retained for compatibility; the default configuration. */
export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 5;
export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 7;

// Documented arcade point formula:
// solving on attempt N (1..5) awards POINTS[N-1]; failing a word awards 0.
export const ARCADE_POINTS: readonly number[] = [500, 400, 300, 250, 200];
export const ARCADE_START_LIVES = 5;
export const ARCADE_MAX_LIVES = 10;
export const ARCADE_START_HINTS = 5;

/** Versioned rule-set identity carried on every round/save. */
export const RULESET_VERSION = "lingo-2.0";

export interface LingoConfig {
  /** Target word length; the engine supports 4-7 letters. */
  length: number;
  maxAttempts: number;
  /**
   * `freeform` accepts any sequence of allowed-alphabet letters of the right
   * length. `dictionary` additionally requires membership in the guess set.
   */
  guessPolicy: GuessPolicy;
  /** Reveal the first letter of the target before the first guess. */
  revealFirstLetter: boolean;
  /**
   * Lock correctly-positioned letters so they automatically appear in
   * subsequent rows. Yellow (present) letters are never locked.
   */
  carryConfirmedLetters: boolean;
}

/**
 * Default rules per game mode. Daily and unlimited games use the modern
 * freeform guessing policy; Classic (arcade) keeps the historical rule that
 * every guess must be a real dictionary word and does not carry confirmed
 * letters forward between rows.
 */
export function modeDefaults(mode: LingoMode): LingoConfig {
  if (mode === "arcade") {
    return {
      length: WORD_LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      guessPolicy: "dictionary",
      revealFirstLetter: true,
      carryConfirmedLetters: false,
    };
  }
  return {
    length: WORD_LENGTH,
    maxAttempts: MAX_ATTEMPTS,
    guessPolicy: "freeform",
    revealFirstLetter: true,
    carryConfirmedLetters: true,
  };
}

export interface LingoRound extends LingoConfig {
  mode: LingoMode;
  /** Language pack the round plays under. */
  language: string;
  /** Rule-set version that adjudicates this round. */
  ruleSet: string;
  target: string;
  firstLetter: string;
  guesses: string[];
  results: CellStatus[][];
  /** Positions whose letter was revealed by a hint. */
  revealed: boolean[];
  /** Positions locked by carry-forward of correctly-placed letters. */
  confirmed: boolean[];
  status: RoundStatus;
  attemptsUsed: number;
}

export interface ArcadeSession {
  mode: "arcade";
  lives: number;
  hints: number;
  score: number;
  solved: number;
  failed: number;
  wordsPlayed: number;
  current: LingoRound;
  over: boolean;
  history: Array<{
    word: string;
    solved: boolean;
    attempts: number;
    points: number;
    lifeGain: boolean;
  }>;
}

export type GuessError =
  | "invalid-word"
  | "not-in-dictionary"
  | "duplicate-word"
  | "wrong-first-letter"
  | "round-over"
  | "hints-empty"
  | "session-over";

export class LingoError extends Error {
  code: GuessError;
  constructor(code: GuessError, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/** Trim, NFC-normalize and lowercase a submission. */
export function normalizeWord(input: string): string {
  return input.trim().normalize("NFC").toLowerCase();
}

const LATVIAN_LETTER_CLASS = "a-zāčēģīķļņšūž";

function latvianWordPattern(length: number): RegExp {
  return new RegExp(`^[${LATVIAN_LETTER_CLASS}]{${length}}$`);
}

/**
 * Structural check: lowercase Latvian-alphabet letters only, exactly
 * `length` characters. Case is not normalized here, so "Rīgas" is rejected
 * until the caller normalizes the input (see `normalizeWord`).
 */
export function isLatvianWord(word: string, length: number = WORD_LENGTH): boolean {
  if (word.length !== length) return false;
  return latvianWordPattern(length).test(word);
}

/**
 * Two-pass evaluation with correct duplicate-letter handling:
 * pass 1 marks exact matches and reserves those letters,
 * pass 2 marks remaining letters present/absent against the leftovers.
 * Length-agnostic; both operands must have identical lengths.
 */
export function evaluateGuess(guess: string, target: string): CellStatus[] {
  if (guess.length !== target.length || guess.length === 0) {
    throw new Error("evaluateGuess expects two words of equal length");
  }
  return evaluateSegments([...guess], [...target]);
}

/**
 * Two-pass evaluation over pre-segmented letters (grapheme clusters).
 * Correctness logic lives here; string convenience wrappers segment first.
 */
export function evaluateSegments(
  guessSegments: readonly string[],
  targetSegments: readonly string[],
): CellStatus[] {
  if (
    guessSegments.length !== targetSegments.length ||
    guessSegments.length === 0
  ) {
    throw new Error("evaluateSegments expects two equal-length words");
  }
  const result: CellStatus[] = new Array(guessSegments.length).fill("absent");
  const remaining: Record<string, number> = {};
  for (let i = 0; i < guessSegments.length; i++) {
    if (guessSegments[i] === targetSegments[i]) {
      result[i] = "correct";
    } else {
      remaining[targetSegments[i]] =
        (remaining[targetSegments[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < guessSegments.length; i++) {
    if (result[i] === "correct") continue;
    const ch = guessSegments[i];
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = "present";
      remaining[ch]--;
    }
  }
  return result;
}

export interface CreateRoundOptions {
  firstLetter?: string;
  length?: number;
  maxAttempts?: number;
  guessPolicy?: GuessPolicy;
  revealFirstLetter?: boolean;
  carryConfirmedLetters?: boolean;
  /** Language pack to validate and segment with (default: Latvian). */
  pack?: LanguagePack;
}

export function createRound(
  target: string,
  mode: LingoMode,
  opts: CreateRoundOptions = {},
): LingoRound {
  const defaults = modeDefaults(mode);
  const pack = opts.pack ?? resolvePack(undefined);
  const length = opts.length ?? defaults.length;
  if (length < MIN_WORD_LENGTH || length > MAX_WORD_LENGTH) {
    throw new Error(`Unsupported word length: ${length}`);
  }
  const maxAttempts = opts.maxAttempts ?? defaults.maxAttempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new Error(`Unsupported attempt limit: ${maxAttempts}`);
  }
  const t = pack.normalizeInput(target);
  if (pack.segmentWord(t).length !== length || !pack.validateCharacters(t)) {
    throw new Error(`Invalid target word: ${target}`);
  }
  const revealFirstLetter = opts.revealFirstLetter ?? defaults.revealFirstLetter;
  return {
    mode,
    language: pack.id,
    ruleSet: RULESET_VERSION,
    target: t,
    firstLetter: revealFirstLetter
      ? (opts.firstLetter ?? t[0]).toLowerCase()
      : "",
    guesses: [],
    results: [],
    revealed: new Array(length).fill(false),
    confirmed: new Array(length).fill(false),
    status: "playing",
    attemptsUsed: 0,
    length,
    maxAttempts,
    guessPolicy: opts.guessPolicy ?? defaults.guessPolicy,
    revealFirstLetter,
    carryConfirmedLetters:
      opts.carryConfirmedLetters ?? defaults.carryConfirmedLetters,
  };
}

/**
 * Submit one guess. Never mutates the input round; throws `LingoError` on
 * rejected submissions so a rejected guess can never consume an attempt.
 */
export function submitGuess(
  round: LingoRound,
  raw: string,
  guessSet: ReadonlySet<string>,
): LingoRound {
  if (round.status !== "playing") {
    throw new LingoError("round-over", "Raunds jau ir beidzies");
  }
  const pack = resolvePack(round.language);
  const word = pack.normalizeInput(raw);
  const segments = pack.segmentWord(word);
  if (segments.length !== round.length) {
    throw new LingoError("invalid-word", `Vārdam jābūt ${round.length} burtu garam`);
  }
  if (!pack.validateCharacters(word)) {
    throw new LingoError(
      "invalid-word",
      `Vārds drīkst saturēt tikai ${pack.displayName.toLowerCase()} valodas burtus`,
    );
  }
  if (round.guessPolicy === "dictionary" && !guessSet.has(word)) {
    throw new LingoError("not-in-dictionary", "Šāds vārds nav vārdnīcā");
  }
  if (round.revealFirstLetter && segments[0] !== round.firstLetter) {
    throw new LingoError(
      "wrong-first-letter",
      `Vārdam jāsākas ar burtu “${round.firstLetter.toUpperCase()}”`,
    );
  }
  if (round.guesses.includes(word)) {
    throw new LingoError("duplicate-word", "Šo vārdu jau mēģināji.");
  }
  if (round.guesses.length >= round.maxAttempts) {
    throw new LingoError("round-over", "Mēģinājumi izsmelti");
  }
  const guesses = [...round.guesses, word];
  const result = evaluateSegments(segments, pack.segmentWord(round.target));
  const results = [...round.results, result];
  const won = word === round.target;
  const lost = !won && guesses.length >= round.maxAttempts;
  let confirmed = round.confirmed;
  if (!won && round.carryConfirmedLetters) {
    confirmed = round.confirmed.map(
      (locked, i) => locked || result[i] === "correct",
    );
  }
  return {
    ...round,
    guesses,
    results,
    confirmed,
    attemptsUsed: guesses.length,
    status: won ? "won" : lost ? "lost" : "playing",
  };
}

/** Positions the player cannot edit: revealed hints, carried letters, first letter. */
export function lockedPositions(round: LingoRound): boolean[] {
  return Array.from(
    { length: round.length },
    (_, i) =>
      round.revealed[i] ||
      round.confirmed[i] ||
      (round.revealFirstLetter && i === 0),
  );
}

/** The fixed letters shown in locked positions, or null where editable. */
export function fixedLetters(round: LingoRound): (string | null)[] {
  return Array.from({ length: round.length }, (_, i) => {
    if (round.revealFirstLetter && i === 0) return round.firstLetter;
    if (round.revealed[i] || round.confirmed[i]) return round.target[i];
    return null;
  });
}

/** Reveal one not-yet-known letter (leftmost). Consumes one hint. */
export function revealLetter(
  round: LingoRound,
  availableHints: number,
): { round: LingoRound; hintsLeft: number } {
  if (round.status !== "playing") {
    throw new LingoError("round-over", "Raunds jau ir beidzies");
  }
  if (availableHints <= 0) {
    throw new LingoError("hints-empty", "Palīdzības izsmeltas");
  }
  const last =
    round.results.length > 0 ? round.results[round.results.length - 1] : null;
  const locked = lockedPositions(round);
  let index = -1;
  for (let i = 0; i < round.length; i++) {
    const knownFromGuess = last !== null && last[i] === "correct";
    if (!locked[i] && !knownFromGuess) {
      index = i;
      break;
    }
  }
  if (index === -1) {
    throw new LingoError("hints-empty", "Nav ko atklāt");
  }
  const revealed = [...round.revealed];
  revealed[index] = true;
  return { round: { ...round, revealed }, hintsLeft: availableHints - 1 };
}

/** Strongest evidence per letter across all rows: correct > present > absent. */
export function keyboardEvidence(
  guesses: readonly string[],
  results: readonly (readonly CellStatus[])[],
): Record<string, CellStatus> {
  const evidence: Record<string, CellStatus> = {};
  const strength: Record<CellStatus, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };
  guesses.forEach((word, i) => {
    for (let j = 0; j < word.length; j++) {
      const ch = word[j];
      const st = results[i][j];
      if (!evidence[ch] || strength[st] > strength[evidence[ch]]) {
        evidence[ch] = st;
      }
    }
  });
  return evidence;
}

export function startArcade(target: string): ArcadeSession {
  return {
    mode: "arcade",
    lives: ARCADE_START_LIVES,
    hints: ARCADE_START_HINTS,
    score: 0,
    solved: 0,
    failed: 0,
    wordsPlayed: 1,
    current: createRound(target, "arcade"),
    over: false,
    history: [],
  };
}

export function arcadeSubmit(
  session: ArcadeSession,
  raw: string,
  guessSet: ReadonlySet<string>,
): ArcadeSession {
  if (session.over) {
    throw new LingoError("session-over", "Spēle ir beigusies");
  }
  const round = submitGuess(session.current, raw, guessSet);
  if (round.status === "playing") {
    return { ...session, current: round };
  }

  const attempts = round.attemptsUsed;
  const solved = round.status === "won";
  const points = solved
    ? ARCADE_POINTS[Math.min(attempts - 1, ARCADE_POINTS.length - 1)]
    : 0;
  let lives = session.lives;
  let lifeGain = false;
  if (solved) {
    if (attempts === 1 && lives < ARCADE_MAX_LIVES) {
      lives += 1;
      lifeGain = true;
    }
  } else {
    lives -= 1;
  }

  return {
    ...session,
    lives,
    score: session.score + points,
    solved: session.solved + (solved ? 1 : 0),
    failed: session.failed + (solved ? 0 : 1),
    over: lives <= 0,
    history: [
      ...session.history,
      { word: round.target, solved, attempts, points, lifeGain },
    ],
  };
}

/** Start the next word in an arcade session. Keeps lives, hints and score. */
export function arcadeNextWord(
  session: ArcadeSession,
  target: string,
): ArcadeSession {
  if (session.over) {
    throw new LingoError("session-over", "Spēle ir beigusies");
  }
  return {
    ...session,
    wordsPlayed: session.wordsPlayed + 1,
    current: createRound(target, "arcade"),
  };
}

export function arcadeHint(session: ArcadeSession): ArcadeSession {
  const { round, hintsLeft } = revealLetter(session.current, session.hints);
  return { ...session, current: round, hints: hintsLeft };
}

export function roundSummary(round: LingoRound): string {
  if (round.status === "won") {
    return `${round.attemptsUsed}/${round.maxAttempts}`;
  }
  return round.status === "lost" ? `X/${round.maxAttempts}` : "…";
}

// ---- Legacy save recovery -------------------------------------------------
// Rounds persisted by V1.0/V1.1/V1.2 lack the config fields. `normalizeRound`
// validates the saved state and fills safe defaults so an old game resumes
// without crashing and without losing history or statistics. It returns null
// when the payload cannot be recovered.

const STATUSES: readonly RoundStatus[] = [
  "playing",
  "won",
  "lost",
  "resolved",
];

function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function isCellStatus(c: unknown): c is CellStatus {
  return c === "correct" || c === "present" || c === "absent";
}

export function normalizeRound(raw: unknown): LingoRound | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.target !== "string") return null;
  const language =
    typeof r.language === "string" && r.language.length > 0 ? r.language : "lv";
  const pack = resolvePack(language);
  const target = pack.normalizeInput(r.target);
  const targetSegments = pack.segmentWord(target);
  const mode: LingoMode =
    r.mode === "daily" || r.mode === "endless" || r.mode === "arcade"
      ? r.mode
      : "daily";
  const defaults = modeDefaults(mode);

  const storedLength = intInRange(r.length, MIN_WORD_LENGTH, MAX_WORD_LENGTH);
  let length: number;
  if (
    targetSegments.length >= MIN_WORD_LENGTH &&
    targetSegments.length <= MAX_WORD_LENGTH
  ) {
    length = targetSegments.length;
  } else if (storedLength !== null) {
    length = storedLength;
  } else {
    return null;
  }
  if (storedLength !== null && storedLength !== length) return null;
  if (!pack.validateCharacters(target)) return null;

  if (!Array.isArray(r.guesses) || !r.guesses.every((g) => typeof g === "string")) {
    return null;
  }
  const guesses = r.guesses as string[];
  if (
    !guesses.every((g) => {
      const normalized = pack.normalizeInput(g);
      return (
        pack.segmentWord(normalized).length === length &&
        pack.validateCharacters(normalized)
      );
    })
  ) {
    return null;
  }

  const maxAttempts =
    intInRange(r.maxAttempts, 1, 20) ?? defaults.maxAttempts;
  const revealFirstLetter =
    typeof r.revealFirstLetter === "boolean"
      ? r.revealFirstLetter
      : defaults.revealFirstLetter;
  const guessPolicy: GuessPolicy =
    r.guessPolicy === "freeform" || r.guessPolicy === "dictionary"
      ? r.guessPolicy
      : defaults.guessPolicy;
  const carryConfirmedLetters =
    typeof r.carryConfirmedLetters === "boolean"
      ? r.carryConfirmedLetters
      : defaults.carryConfirmedLetters;

  const storedResults = Array.isArray(r.results) ? r.results : null;
  let results: CellStatus[][];
  if (
    storedResults &&
    storedResults.length >= guesses.length &&
    storedResults
      .slice(0, guesses.length)
      .every(
        (row) =>
          Array.isArray(row) &&
          row.length === length &&
          (row as unknown[]).every(isCellStatus),
      )
  ) {
    results = (storedResults.slice(0, guesses.length) as unknown[]).map(
      (row) => row as CellStatus[],
    );
  } else {
    try {
      results = guesses.map((g) => evaluateGuess(g, target));
    } catch {
      return null;
    }
  }

  const solved = guesses.includes(target);
  let status: RoundStatus = STATUSES.includes(r.status as RoundStatus)
    ? (r.status as RoundStatus)
    : solved
      ? "won"
      : guesses.length >= maxAttempts
        ? "lost"
        : "playing";
  // Repair internally inconsistent terminal states without rewriting history.
  if (status === "won" && !solved) {
    status = guesses.length >= maxAttempts ? "lost" : "playing";
  }
  if (status === "lost" && !solved && guesses.length < maxAttempts) {
    status = "playing";
  }
  if (status === "playing" && solved) {
    status = "won";
  }

  const revealed =
    Array.isArray(r.revealed) &&
    r.revealed.length === length &&
    r.revealed.every((v) => typeof v === "boolean")
      ? (r.revealed as boolean[])
      : new Array(length).fill(false);
  let confirmed: boolean[];
  if (
    Array.isArray(r.confirmed) &&
    r.confirmed.length === length &&
    r.confirmed.every((v) => typeof v === "boolean")
  ) {
    confirmed = r.confirmed as boolean[];
  } else if (
    carryConfirmedLetters &&
    status === "playing" &&
    results.length > 0
  ) {
    confirmed = results[results.length - 1].map((c) => c === "correct");
  } else {
    confirmed = new Array(length).fill(false);
  }

  const firstLetter =
    typeof r.firstLetter === "string" && r.firstLetter.length > 0
      ? r.firstLetter.toLowerCase()
      : target[0];
  const attemptsUsed = intInRange(r.attemptsUsed, 0, 20) ?? guesses.length;

  return {
    mode,
    language,
    ruleSet:
      typeof r.ruleSet === "string" && r.ruleSet.length > 0
        ? r.ruleSet
        : RULESET_VERSION,
    target,
    firstLetter,
    guesses,
    results,
    revealed,
    confirmed,
    status,
    attemptsUsed,
    length,
    maxAttempts,
    guessPolicy,
    revealFirstLetter,
    carryConfirmedLetters,
  };
}
