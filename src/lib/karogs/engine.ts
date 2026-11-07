// Pure, framework-free Karogs (Stratego-style) engine.
// All state is plain JSON-safe data. No randomness inside the engine itself.

export type Side = "red" | "blue";
export const otherSide = (s: Side): Side => (s === "red" ? "blue" : "red");

export const BOARD_SIZE = 10;
// The two classic 2x2 lakes: columns 2-3 and 6-7, rows 4-5 (0-indexed).
export const LAKE_CELLS = new Set<number>([42, 43, 52, 53, 46, 47, 56, 57]);

export const ZONE_ROWS: Record<Side, number[]> = {
  red: [6, 7, 8, 9],
  blue: [0, 1, 2, 3],
};

export const NO_CAPTURE_DRAW_HALF_MOVES = 120;
export const REPETITION_LIMIT = 3;

export const RANKS: readonly number[] = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export const ARMY: ReadonlyArray<{
  rank: number | "bomb" | "flag";
  kind: "movable" | "bomb" | "flag";
  count: number;
  name: string;
}> = [
  { rank: 10, kind: "movable", count: 1, name: "Maršals" },
  { rank: 9, kind: "movable", count: 1, name: "Ģenerālis" },
  { rank: 8, kind: "movable", count: 2, name: "Pulkvedis" },
  { rank: 7, kind: "movable", count: 3, name: "Majors" },
  { rank: 6, kind: "movable", count: 4, name: "Kapteinis" },
  { rank: 5, kind: "movable", count: 4, name: "Leitnants" },
  { rank: 4, kind: "movable", count: 4, name: "Seržants" },
  { rank: 3, kind: "movable", count: 5, name: "Mīnētājs" },
  { rank: 2, kind: "movable", count: 8, name: "Izlūks" },
  { rank: 1, kind: "movable", count: 1, name: "Spiegs" },
  { rank: "bomb", kind: "bomb", count: 6, name: "Bumba" },
  { rank: "flag", kind: "flag", count: 1, name: "Karogs" },
];

export const ARMY_SIZE = ARMY.reduce((n, p) => n + p.count, 0); // 40

export function pieceName(piece: {
  kind: "movable" | "bomb" | "flag";
  rank: number | null;
}): string {
  if (piece.kind === "flag") return "Karogs";
  if (piece.kind === "bomb") return "Bumba";
  const entry = ARMY.find((a) => a.rank === piece.rank);
  return entry?.name ?? "?";
}

export interface Piece {
  id: string;
  owner: Side;
  kind: "movable" | "bomb" | "flag";
  rank: number | null;
  /** Does the red player know this piece's identity? */
  redSees: boolean;
  /** Does the blue player know this piece's identity? */
  blueSees: boolean;
}

export interface HiddenPiece {
  id: string;
  owner: Side;
  hidden: true;
}

export type Cell = Piece | HiddenPiece | null;

export interface Move {
  pieceId: string;
  to: number;
}

export type MoveOutcome = "move" | "attack" | "capture-flag" | "lost-attack" | "draw-attack";

export interface MoveRecord extends Move {
  side: Side;
  from: number;
  outcome: MoveOutcome;
  attackerRank: number | null;
  attackerKind: "movable" | "bomb" | "flag";
  defenderRank: number | null;
  defenderKind: "movable" | "bomb" | "flag" | null;
  /** Pieces whose identity became publicly known due to this move. */
  revealed: string[];
  captured: string[]; // piece ids removed
}

export type Phase = "setup" | "playing" | "finished";

export interface GameState {
  phase: Phase;
  turn: Side;
  board: (Piece | null)[];
  setups: Record<Side, Record<number, Piece> | null>;
  captured: Record<Side, number>;
  moves: MoveRecord[];
  noCaptureHalfMoves: number;
  /** Position hash -> occurrence count, for repetition draws. */
  positionCounts: Record<string, number>;
  /** Last two (from,to) moves per piece, for the two-square rule. */
  pieceLastMoves: Record<string, Array<{ from: number; to: number }>>;
  winner: Side | "draw" | null;
  endReason: string | null;
  startedAt: number;
  endedAt: number | null;
}

export const idx = (x: number, y: number): number => y * BOARD_SIZE + x;
export const xy = (i: number): { x: number; y: number } => ({
  x: i % BOARD_SIZE,
  y: Math.floor(i / BOARD_SIZE),
});

export function inBounds(i: number): boolean {
  return i >= 0 && i < BOARD_SIZE * BOARD_SIZE;
}

export function inZone(side: Side, i: number): boolean {
  return ZONE_ROWS[side].includes(xy(i).y);
}

export function isLake(i: number): boolean {
  return LAKE_CELLS.has(i);
}

export function createArmy(side: Side): Piece[] {
  const army: Piece[] = [];
  for (const entry of ARMY) {
    for (let i = 0; i < entry.count; i++) {
      army.push({
        id: `${side}-${entry.rank}-${i}`,
        owner: side,
        kind: entry.kind,
        rank: entry.rank === "bomb" || entry.rank === "flag" ? null : entry.rank,
        redSees: false,
        blueSees: false,
      });
    }
  }
  return army;
}

export function emptyBoard(): (Piece | null)[] {
  return new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
}

export function createGame(): GameState {
  return {
    phase: "setup",
    turn: "red",
    board: emptyBoard(),
    setups: { red: null, blue: null },
    captured: { red: 0, blue: 0 },
    moves: [],
    noCaptureHalfMoves: 0,
    positionCounts: {},
    pieceLastMoves: {},
    winner: null,
    endReason: null,
    startedAt: Date.now(),
    endedAt: null,
  };
}

export class KarogsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Validate and register a full army placement for one side. */
export function setSetup(
  state: GameState,
  side: Side,
  placement: Record<number, Piece>,
): GameState {
  if (state.phase !== "setup") {
    throw new KarogsError("bad-phase", "Izvietošana vairs nav iespējama");
  }
  const entries = Object.entries(placement);
  if (entries.length !== ARMY_SIZE) {
    throw new KarogsError(
      "bad-army",
      `Armijā jābūt tieši ${ARMY_SIZE} figūrām (pašlaik ${entries.length})`,
    );
  }
  const army = createArmy(side);
  const seenIds = new Set<string>();
  const seenCells = new Set<number>();
  for (const [cellStr, piece] of entries) {
    const cell = Number(cellStr);
    if (!Number.isInteger(cell) || !inBounds(cell)) {
      throw new KarogsError("bad-cell", "Figūra ārpus laukuma");
    }
    if (isLake(cell)) {
      throw new KarogsError("bad-cell", "Figūra nevar atrasties ezerā");
    }
    if (!inZone(side, cell)) {
      throw new KarogsError("bad-cell", "Figūra ārpus izvietošanas zonas");
    }
    if (piece.owner !== side) {
      throw new KarogsError("bad-piece", "Svešas armijas figūra");
    }
    if (!army.some((a) => a.kind === piece.kind && a.rank === piece.rank)) {
      throw new KarogsError("bad-piece", "Nederīga figūra armijā");
    }
    if (seenCells.has(cell)) {
      throw new KarogsError("bad-cell", "Vienā lauciņā divas figūras");
    }
    if (seenIds.has(piece.id)) {
      throw new KarogsError("bad-piece", "Viena figūra izvietota divreiz");
    }
    seenCells.add(cell);
    seenIds.add(piece.id);
  }
  // Ids must come from this side's army (exact set), preventing duplicates.
  const expected = new Set(army.map((a) => a.id));
  for (const id of seenIds) {
    if (!expected.has(id)) {
      throw new KarogsError("bad-piece", "Svešas armijas figūras id");
    }
  }
  return {
    ...state,
    setups: { ...state.setups, [side]: { ...placement } },
  };
}

function buildBoard(setups: Record<Side, Record<number, Piece> | null>): (Piece | null)[] {
  const board = emptyBoard();
  for (const side of ["red", "blue"] as Side[]) {
    const setup = setups[side];
    if (!setup) throw new KarogsError("no-setup", "Trūkst armijas izvietojuma");
    for (const [cellStr, piece] of Object.entries(setup)) {
      const cell = Number(cellStr);
      board[cell] = {
        ...piece,
        owner: side,
        redSees: side === "red",
        blueSees: side === "blue",
      };
    }
  }
  return board;
}

/** Move from setup phase to playing. Red moves first. */
export function startGame(state: GameState): GameState {
  if (state.phase !== "setup") {
    throw new KarogsError("bad-phase", "Spēle jau ir sākta");
  }
  if (!state.setups.red || !state.setups.blue) {
    throw new KarogsError("no-setup", "Abām armijām jābūt izvietotām");
  }
  const board = buildBoard(state.setups);
  const positionKey = positionSignature(board, "red");
  return {
    ...state,
    phase: "playing",
    board,
    positionCounts: { [positionKey]: 1 },
    startedAt: Date.now(),
  };
}

export function positionSignature(
  board: (Piece | HiddenPiece | null)[],
  turn: Side,
): string {
  const parts: string[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) {
      parts.push(".");
    } else if ("hidden" in p) {
      parts.push(`${p.owner[0]}?`);
    } else {
      parts.push(`${p.owner[0]}${p.kind[0]}${p.rank ?? "x"}`);
    }
  }
  parts.push(turn);
  return parts.join("");
}

function findPiece(state: GameState, pieceId: string): { piece: Piece; at: number } | null {
  for (let i = 0; i < state.board.length; i++) {
    const p = state.board[i];
    if (p && !("hidden" in p) && p.id === pieceId) return { piece: p, at: i };
  }
  return null;
}

function isTwoSquareViolation(
  pieceId: string,
  from: number,
  to: number,
  lastMoves: Record<string, Array<{ from: number; to: number }>>,
): boolean {
  const history = lastMoves[pieceId] ?? [];
  if (history.length < 2) return false;
  const [prev, prev2] = [history[history.length - 1], history[history.length - 2]];
  return prev.to === from && prev.from === to && prev2.from === from && prev2.to === to;
}

/** All legal moves for the given side. */
export function legalMoves(state: GameState, side: Side): Move[] {
  if (state.phase !== "playing" || state.turn !== side) return [];
  return legalMovesForCells(state.board, side, state.turn, state.pieceLastMoves);
}

/**
 * Legal moves for a side computed from a (possibly redacted) cell array.
 * Hidden enemy pieces are treated as attackable blockers, exactly as the
 * owner of `side` would see them.
 */
export function legalMovesForCells(
  cells: (Piece | HiddenPiece | null)[],
  side: Side,
  turn: Side,
  pieceLastMoves: Record<string, Array<{ from: number; to: number }>> = {},
): Move[] {
  if (turn !== side) return [];
  const moves: Move[] = [];
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (!p || "hidden" in p) continue;
    if (!p || p.owner !== side || p.kind !== "movable") continue;
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const maxRange = p.rank === 2 ? BOARD_SIZE : 1;
    for (const [dx, dy] of dirs) {
      const { x, y } = xy(i);
      for (let step = 1; step <= maxRange; step++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        const cell = idx(nx, ny);
        if (isLake(cell)) break;
        const target = cells[cell];
        if (target) {
          if (target.owner !== side) {
            if (!isTwoSquareViolation(p.id, i, cell, pieceLastMoves)) {
              moves.push({ pieceId: p.id, to: cell });
            }
          }
          break; // blocked either way
        }
        if (!isTwoSquareViolation(p.id, i, cell, pieceLastMoves)) {
          moves.push({ pieceId: p.id, to: cell });
        }
      }
    }
  }
  return moves;
}

interface CombatOutcome {
  attackerSurvives: boolean;
  defenderSurvives: boolean;
  flagCaptured: boolean;
}

export function resolveCombat(
  attacker: Piece,
  defender: Piece,
): CombatOutcome {
  if (defender.kind === "flag") {
    return { attackerSurvives: true, defenderSurvives: false, flagCaptured: true };
  }
  if (defender.kind === "bomb") {
    const defused = attacker.rank === 3;
    return {
      attackerSurvives: defused,
      defenderSurvives: !defused,
      flagCaptured: false,
    };
  }
  const a = attacker.rank ?? 0;
  const d = defender.rank ?? 0;
  if (a === 1 && d === 10) {
    // Spy defeats the Marshal only when attacking.
    return { attackerSurvives: true, defenderSurvives: false, flagCaptured: false };
  }
  if (a > d) return { attackerSurvives: true, defenderSurvives: false, flagCaptured: false };
  if (a === d) return { attackerSurvives: false, defenderSurvives: false, flagCaptured: false };
  return { attackerSurvives: false, defenderSurvives: true, flagCaptured: false };
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase !== "playing") {
    throw new KarogsError("bad-phase", "Spēle nav sākta");
  }
  const found = findPiece(state, move.pieceId);
  if (!found) {
    throw new KarogsError("no-piece", "Figūra nav atrodama");
  }
  const { piece, at: from } = found;
  if (piece.owner !== state.turn) {
    throw new KarogsError("wrong-turn", "Nav jūsu kārta");
  }
  const legal = legalMoves(state, state.turn).some(
    (m) => m.pieceId === move.pieceId && m.to === move.to,
  );
  if (!legal) {
    throw new KarogsError("illegal-move", "Nederīgs gājiens");
  }

  const board = [...state.board];
  const defender = board[move.to];
  const outcome: CombatOutcome =
    defender && defender.owner !== piece.owner
      ? resolveCombat(piece, defender)
      : { attackerSurvives: true, defenderSurvives: true, flagCaptured: false };

  board[from] = null;
  const revealed: string[] = [];
  const captured: string[] = [];

  let moveOutcome: MoveOutcome = "move";
  if (defender && defender.owner !== piece.owner) {
    moveOutcome = "attack";
    if (outcome.flagCaptured) moveOutcome = "capture-flag";
    revealed.push(piece.id, defender.id);
    if (!outcome.attackerSurvives) {
      captured.push(piece.id);
      board[move.to] = defender;
      if (outcome.defenderSurvives === false) {
        // equal ranks: both die
        captured.push(defender.id);
        board[move.to] = null;
      } else {
        moveOutcome = "lost-attack";
      }
    } else if (!outcome.defenderSurvives) {
      captured.push(defender.id);
      board[move.to] = piece;
    } else {
      // Both survive is impossible for movable combat; keep safe.
      board[move.to] = piece;
    }
  } else {
    board[move.to] = piece;
  }

  const capturedCounts = { ...state.captured };
  for (const id of captured) {
    const owner = id.startsWith("red") ? "red" : "blue";
    capturedCounts[owner] += 1;
  }

  const pieceLastMoves = { ...state.pieceLastMoves };
  const previous = pieceLastMoves[piece.id] ?? [];
  pieceLastMoves[piece.id] = [...previous.slice(-1), { from, to: move.to }];

  const moves = [
    ...state.moves,
    {
      ...move,
      side: state.turn,
      from,
      outcome: moveOutcome,
      attackerRank: piece.rank,
      attackerKind: piece.kind,
      defenderRank: defender ? defender.rank : null,
      defenderKind: defender ? defender.kind : null,
      revealed,
      captured,
    },
  ];

  let boardOut = board;
  if (moveOutcome === "capture-flag") {
    boardOut = board;
  }
  if (revealed.length > 0) {
    boardOut = board.map((p) =>
      p && revealed.includes(p.id)
        ? { ...p, redSees: true, blueSees: true }
        : p,
    );
  }

  const nextTurn = otherSide(state.turn);
  const noCaptureHalfMoves = captured.length > 0 ? 0 : state.noCaptureHalfMoves + 1;
  const positionKey = positionSignature(boardOut, nextTurn);
  const positionCounts = { ...state.positionCounts };
  positionCounts[positionKey] = (positionCounts[positionKey] ?? 0) + 1;

  let winner: Side | "draw" | null = null;
  let endReason: string | null = null;

  const provisional: GameState = {
    ...state,
    board: boardOut,
    turn: nextTurn,
    captured: capturedCounts,
    moves,
    noCaptureHalfMoves,
    positionCounts,
    pieceLastMoves,
    winner: null,
    endReason: null,
  };

  if (moveOutcome === "capture-flag") {
    winner = state.turn;
    endReason = "flag-captured";
  } else if (legalMoves(provisional, nextTurn).length === 0) {
    winner = state.turn;
    endReason = "no-legal-moves";
  } else if (positionCounts[positionKey] >= REPETITION_LIMIT) {
    winner = "draw";
    endReason = "repetition";
  } else if (noCaptureHalfMoves >= NO_CAPTURE_DRAW_HALF_MOVES) {
    winner = "draw";
    endReason = "no-capture";
  }

  if (winner) {
    return {
      ...provisional,
      phase: "finished",
      winner,
      endReason,
      endedAt: Date.now(),
    };
  }
  return provisional;
}

export function resign(state: GameState, side: Side): GameState {
  if (state.phase !== "playing") {
    throw new KarogsError("bad-phase", "Spēle nav sākta");
  }
  return {
    ...state,
    phase: "finished",
    winner: otherSide(side),
    endReason: "resignation",
    endedAt: Date.now(),
  };
}

/** View of the board as a given side legitimately sees it. */
export function redactFor(
  state: GameState,
  side: Side,
): (Piece | HiddenPiece | null)[] {
  return state.board.map((p) => {
    if (!p) return null;
    if (p.owner === side) return p;
    const sees = side === "red" ? p.redSees : p.blueSees;
    return sees ? p : { id: p.id, owner: p.owner, hidden: true };
  });
}

export function redactedForTurn(state: GameState): (Piece | HiddenPiece | null)[] {
  return redactFor(state, state.turn);
}

export function allRevealed(state: GameState): (Piece | null)[] {
  return state.board.map((p) =>
    p ? { ...p, redSees: true, blueSees: true } : null,
  );
}

export function randomSetup(
  side: Side,
  rng: () => number,
): Record<number, Piece> {
  const cells = ZONE_ROWS[side].flatMap((y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => idx(x, y)),
  );
  const shuffled = [...cells];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const army = createArmy(side);
  const placement: Record<number, Piece> = {};
  army.forEach((piece, i) => {
    placement[shuffled[i]] = piece;
  });
  return placement;
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGame(raw: string): GameState {
  const parsed = JSON.parse(raw) as GameState;
  if (
    !parsed ||
    parsed.board?.length !== BOARD_SIZE * BOARD_SIZE ||
    !parsed.setups ||
    !parsed.captured
  ) {
    throw new KarogsError("bad-serialization", "Bojāts spēles stāvoklis");
  }
  return parsed;
}
