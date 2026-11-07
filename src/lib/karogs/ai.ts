// Karogs AI. The AI decision interface (AiStateView) never contains hidden
// opponent ranks: hidden enemy pieces appear as { hidden: true }.

import {
  type Cell,
  type GameState,
  type HiddenPiece,
  type Move,
  type Piece,
  type Side,
  ARMY,
  legalMoves,
  otherSide,
  redactFor,
  resolveCombat,
  xy,
} from "./engine";
import { mulberry32 } from "@/lib/utils";

export type AiDifficulty = "easy" | "medium" | "hard";

export interface AiStateView {
  turn: Side;
  phase: GameState["phase"];
  board: Cell[];
  captured: Record<Side, number>;
  moves: GameState["moves"];
  noCaptureHalfMoves: number;
  pieceLastMoves: GameState["pieceLastMoves"];
  winner: Side | "draw" | null;
}

export function aiView(state: GameState, side: Side): AiStateView {
  return {
    turn: state.turn,
    phase: state.phase,
    board: redactFor(state, side),
    captured: state.captured,
    moves: state.moves,
    noCaptureHalfMoves: state.noCaptureHalfMoves,
    pieceLastMoves: state.pieceLastMoves,
    winner: state.winner,
  };
}

const pieceValue = (rank: number | null, kind: Piece["kind"]): number => {
  if (kind === "flag") return 1000;
  if (kind === "bomb") return 35;
  return (rank ?? 0) * 10;
};

function isHidden(p: Cell): p is HiddenPiece {
  return !!p && "hidden" in p;
}

function pieceAt(view: AiStateView, at: number): Piece | HiddenPiece | null {
  return view.board[at];
}

/** Multiset of opponent pieces not yet seen or captured (best inference). */
export function unknownPool(
  view: AiStateView,
  side: Side,
): Array<"bomb" | "flag" | { rank: number; kind: "movable" }> {
  const enemy = otherSide(side);
  const inventory: Array<{ rank: number | null; kind: Piece["kind"]; id: string }> = [];
  for (const entry of ARMY) {
    for (let i = 0; i < entry.count; i++) {
      inventory.push({
        rank: entry.rank === "bomb" || entry.rank === "flag" ? null : entry.rank,
        kind: entry.kind,
        id: `${enemy}-${entry.rank}-${i}`,
      });
    }
  }
  const seenIds = new Set<string>();
  for (const cell of view.board) {
    if (cell && cell.owner === enemy && !isHidden(cell)) seenIds.add(cell.id);
  }
  for (const rec of view.moves) {
    for (const id of rec.captured) {
      if (id.startsWith(enemy)) seenIds.add(id);
    }
  }
  const unknown: Array<"bomb" | "flag" | { rank: number; kind: "movable" }> = [];
  for (const p of inventory) {
    if (seenIds.has(p.id)) continue;
    if (p.kind === "movable") {
      unknown.push({ rank: p.rank as number, kind: "movable" });
    } else {
      unknown.push(p.kind);
    }
  }
  return unknown;
}

interface PoolStats {
  bombs: number;
  flags: number;
  movables: number[];
}

function poolStats(pool: Array<"bomb" | "flag" | { rank: number; kind: "movable" }>): PoolStats {
  const bombs = pool.filter((p) => p === "bomb").length;
  const flags = pool.filter((p) => p === "flag").length;
  const movables = pool
    .filter((p): p is { rank: number; kind: "movable" } => p !== "bomb" && p !== "flag")
    .map((p) => p.rank);
  return { bombs, flags, movables };
}

function expectedRank(stats: PoolStats): number {
  const total = stats.movables.length + stats.bombs + stats.flags;
  if (total === 0) return 5;
  return (
    (stats.movables.reduce((a, b) => a + b, 0) + stats.bombs * 11 + stats.flags * 0) /
    total
  );
}

export interface AiDecision {
  move: Move;
  score: number;
}

function pickWeighted<T>(
  items: Array<{ item: T; score: number }>,
  rng: () => number,
  temperature: number,
): T {
  if (items.length === 0) throw new Error("no moves");
  const max = Math.max(...items.map((i) => i.score));
  const weights = items.map((i) => Math.exp((i.score - max) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i].item;
  }
  return items[items.length - 1].item;
}

function fromOf(view: AiStateView, pieceId: string): number {
  return view.board.findIndex(
    (c) => c && !isHidden(c) && c.id === pieceId,
  );
}

/** Score a candidate move for `side` using only the redacted view. */
function scoreMove(
  view: AiStateView,
  side: Side,
  move: Move,
  pool: PoolStats,
): number {
  const from = fromOf(view, move.pieceId);
  const attacker = pieceAt(view, from);
  if (!attacker || isHidden(attacker)) return -1000;
  const target = pieceAt(view, move.to);
  const attackerValue = pieceValue(attacker.rank, attacker.kind);
  const enemy = otherSide(side);

  let score = 0;
  if (target && target.owner === enemy) {
    if (isHidden(target)) {
      const total = pool.movables.length + pool.bombs + pool.flags;
      if (total === 0) return 10;
      const pBomb = pool.bombs / total;
      const pFlag = pool.flags / total;
      const isMiner = attacker.rank === 3;
      const exp = expectedRank(pool);
      const pWinMovable = isMiner
        ? 0.55
        : Math.max(0.05, Math.min(0.95, (attacker.rank ?? 0) / 10 - exp / 22 + 0.5));
      const gain = pieceValue(3, "movable") * pWinMovable + (isMiner ? 35 : -20) * pBomb + 1000 * pFlag;
      const risk = attackerValue * (1 - pWinMovable);
      score = gain - risk + 8; // +8 for information
    } else {
      const outcome = resolveCombat(attacker, target);
      if (outcome.flagCaptured) return 10000;
      const defenderValue = pieceValue(target.rank, target.kind);
      if (outcome.attackerSurvives && !outcome.defenderSurvives) {
        score = defenderValue + 12;
      } else if (!outcome.attackerSurvives && outcome.defenderSurvives) {
        score = -attackerValue - 15;
      } else {
        score = defenderValue - attackerValue; // mutual destruction
      }
    }
  } else if (!target) {
    // Positional terms
    const { y: fromY } = xy(from);
    const { y: toY } = xy(move.to);
    const forward = side === "blue" ? toY - fromY : fromY - toY;
    score += forward * 2;
    if (attacker.rank === 2) score += forward * 2; // scouts explore
    // Guard the own flag
    const flagAt = view.board.findIndex(
      (c) => c && !isHidden(c) && c.owner === side && c.kind === "flag",
    );
    if (flagAt >= 0) {
      const { x: fx, y: fy } = xy(flagAt);
      const { x: tx, y: ty } = xy(move.to);
      const distBefore = Math.abs(xy(from).x - fx) + Math.abs(xy(from).y - fy);
      const distAfter = Math.abs(tx - fx) + Math.abs(ty - fy);
      if (distAfter <= 1 && distBefore > 1) score += 6;
    }
  }
  return score;
}

function legalMovesForView(view: AiStateView, side: Side): Move[] {
  // Reuse the engine's legality on a synthetic state built from the view.
  const synthetic: GameState = {
    phase: view.phase,
    turn: view.turn,
    board: view.board as (Piece | null)[],
    setups: { red: null, blue: null },
    captured: view.captured,
    moves: view.moves,
    noCaptureHalfMoves: view.noCaptureHalfMoves,
    positionCounts: {},
    pieceLastMoves: view.pieceLastMoves,
    winner: view.winner,
    endReason: null,
    startedAt: 0,
    endedAt: null,
  };
  return legalMoves(synthetic, side);
}

export function chooseMove(
  view: AiStateView,
  side: Side,
  difficulty: AiDifficulty,
  rng: () => number = Math.random,
): Move {
  if (view.turn !== side || view.phase !== "playing") {
    throw new Error("AI called out of turn");
  }
  const moves = legalMovesForView(view, side);
  if (moves.length === 0) {
    throw new Error("AI has no legal moves (game should be over)");
  }
  const pool = poolStats(unknownPool(view, side));

  if (difficulty === "easy") {
    const scored = moves.map((move) => {
      const base = scoreMove(view, side, move, pool);
      return { item: move, score: base + rng() * 70 };
    });
    return pickWeighted(scored, rng, 45);
  }

  if (difficulty === "medium") {
    const scored = moves.map((move) => {
      const base = scoreMove(view, side, move, pool);
      return { item: move, score: base + rng() * 22 };
    });
    return pickWeighted(scored, rng, 16);
  }

  // Hard: depth-2 alpha-beta search with expected-value combat on unknowns.
  const evaluate = (v: AiStateView, aiSide: Side): number => {
    let value = 0;
    for (const cell of v.board) {
      if (!cell) continue;
      if (isHidden(cell)) {
        value += cell.owner === aiSide ? 0 : 5; // unknown enemy presence
        continue;
      }
      const sign = cell.owner === aiSide ? 1 : -1;
      value += sign * pieceValue(cell.rank, cell.kind);
    }
    return value;
  };

  const simulate = (v: AiStateView, mover: Side, move: Move, p: PoolStats): AiStateView => {
    const board = [...v.board];
    const from = fromOf(v, move.pieceId);
    const attacker = board[from];
    const target = board[move.to];
    if (!attacker || isHidden(attacker)) return v;
    board[from] = null;
    const captured: string[] = [];
    if (target && target.owner !== mover) {
      let attackerSurvives: boolean;
      let defenderSurvives: boolean;
      if (isHidden(target)) {
        const exp = expectedRank(p);
        const isMiner = attacker.rank === 3;
        attackerSurvives = isMiner ? exp <= 8 : (attacker.rank ?? 0) > exp;
        defenderSurvives = !attackerSurvives;
      } else {
        const outcome = resolveCombat(attacker, target);
        attackerSurvives = outcome.attackerSurvives;
        defenderSurvives = outcome.defenderSurvives;
      }
      if (!attackerSurvives) captured.push(attacker.id);
      if (!defenderSurvives) captured.push(target.id);
      board[move.to] = attackerSurvives ? attacker : defenderSurvives ? target : null;
    } else {
      board[move.to] = attacker;
    }
    return {
      ...v,
      turn: otherSide(mover),
      board,
      captured: {
        red: v.captured.red + captured.filter((id) => id.startsWith("red")).length,
        blue: v.captured.blue + captured.filter((id) => id.startsWith("blue")).length,
      },
    };
  };

  const search = (
    v: AiStateView,
    depth: number,
    alpha: number,
    beta: number,
    aiSide: Side,
    p: PoolStats,
  ): number => {
    const mover = v.turn;
    const maximizing = mover === aiSide;
    if (depth === 0) return evaluate(v, aiSide);
    const candidates = legalMovesForView(v, mover);
    if (candidates.length === 0) {
      return maximizing ? -10000 : 10000;
    }
    // Order: attacks first.
    const ordered = [...candidates].sort((a, b) => {
      const aAttack = v.board[a.to] !== null ? 1 : 0;
      const bAttack = v.board[b.to] !== null ? 1 : 0;
      return bAttack - aAttack;
    });
    if (maximizing) {
      let best = -Infinity;
      for (const move of ordered) {
        const next = simulate(v, mover, move, p);
        const val = search(next, depth - 1, alpha, beta, aiSide, p);
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const move of ordered) {
      const next = simulate(v, mover, move, p);
      const val = search(next, depth - 1, alpha, beta, aiSide, p);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  };

  const scored = moves.map((move) => {
    const next = simulate(view, side, move, pool);
    const val = search(next, 1, -Infinity, Infinity, side, pool);
    return { item: move, score: val + rng() * 6 };
  });
  return pickWeighted(scored, rng, 5);
}

/** Deterministic AI for tests: same seed yields the same move. */
export function seededAi(
  seed: number,
): (view: AiStateView, side: Side, difficulty: AiDifficulty) => Move {
  const rng = mulberry32(seed);
  return (view, side, difficulty) => chooseMove(view, side, difficulty, rng);
}

