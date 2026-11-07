// Pure, framework-free Lingo game engine. State is plain JSON-safe data;
// every mutation returns a new state object.

export type CellStatus = "correct" | "present" | "absent";
export type RoundStatus = "playing" | "won" | "lost";
export type LingoMode = "daily" | "endless" | "arcade";

export const MAX_ATTEMPTS = 5;
export const WORD_LENGTH = 5;

// Documented arcade point formula:
// solving on attempt N (1..5) awards POINTS[N-1]; failing a word awards 0.
export const ARCADE_POINTS: readonly number[] = [500, 400, 300, 250, 200];
export const ARCADE_START_LIVES = 5;
export const ARCADE_MAX_LIVES = 10;
export const ARCADE_START_HINTS = 5;

export interface LingoRound {
  mode: LingoMode;
  target: string;
  firstLetter: string;
  guesses: string[];
  results: CellStatus[][];
  /** Positions whose letter was revealed by a hint. */
  revealed: boolean[];
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

export function isLatvianWord(word: string): boolean {
  return /^[a-zāčēģīķļņšūž]{5}$/.test(word);
}

/**
 * Two-pass evaluation with correct duplicate-letter handling:
 * pass 1 marks exact matches and reserves those letters,
 * pass 2 marks remaining letters present/absent against the leftovers.
 */
export function evaluateGuess(guess: string, target: string): CellStatus[] {
  if (guess.length !== WORD_LENGTH || target.length !== WORD_LENGTH) {
    throw new Error("evaluateGuess expects two 5-letter words");
  }
  const result: CellStatus[] = new Array(WORD_LENGTH).fill("absent");
  const remaining: Record<string, number> = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = "present";
      remaining[ch]--;
    }
  }
  return result;
}

export function createRound(
  target: string,
  mode: LingoMode,
  opts: { firstLetter?: string } = {},
): LingoRound {
  const t = normalizeWord(target);
  if (!isLatvianWord(t)) {
    throw new Error(`Invalid target word: ${target}`);
  }
  return {
    mode,
    target: t,
    firstLetter: (opts.firstLetter ?? t[0]).toLowerCase(),
    guesses: [],
    results: [],
    revealed: new Array(WORD_LENGTH).fill(false),
    status: "playing",
    attemptsUsed: 0,
  };
}

export function submitGuess(
  round: LingoRound,
  raw: string,
  guessSet: ReadonlySet<string>,
): LingoRound {
  if (round.status !== "playing") {
    throw new LingoError("round-over", "Raunds jau ir beidzies");
  }
  const word = normalizeWord(raw);
  if (!isLatvianWord(word)) {
    throw new LingoError("invalid-word", "Vārdam jābūt 5 burtu garam");
  }
  if (!guessSet.has(word)) {
    throw new LingoError("not-in-dictionary", "Šāds vārds nav vārdnīcā");
  }
  if (word[0] !== round.firstLetter) {
    throw new LingoError(
      "wrong-first-letter",
      `Vārdam jāsākas ar burtu “${round.firstLetter.toUpperCase()}”`,
    );
  }
  if (round.guesses.includes(word)) {
    throw new LingoError("duplicate-word", "Šo vārdu jau mēģināji.");
  }
  if (round.guesses.length >= MAX_ATTEMPTS) {
    throw new LingoError("round-over", "Mēģinājumi izsmelti");
  }
  const guesses = [...round.guesses, word];
  const results = [...round.results, evaluateGuess(word, round.target)];
  const won = word === round.target;
  const lost = !won && guesses.length >= MAX_ATTEMPTS;
  return {
    ...round,
    guesses,
    results,
    attemptsUsed: guesses.length,
    status: won ? "won" : lost ? "lost" : "playing",
  };
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
  const known = round.results.some((row) => row.some((c) => c === "correct"))
    ? round.results[round.results.length - 1]
    : null;
  let index = -1;
  for (let i = 1; i < WORD_LENGTH; i++) {
    const knownFromGuess = known !== null && known[i] === "correct";
    if (!round.revealed[i] && !knownFromGuess) {
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
  const strength: Record<CellStatus, number> = { correct: 3, present: 2, absent: 1 };
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
  const points = solved ? ARCADE_POINTS[Math.min(attempts - 1, ARCADE_POINTS.length - 1)] : 0;
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
    return `${round.attemptsUsed}/${MAX_ATTEMPTS}`;
  }
  return round.status === "lost" ? "X/5" : "…";
}
