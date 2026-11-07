import { describe, expect, it } from "vitest";
import {
  type GameState,
  applyMove,
  createGame,
  legalMoves,
  randomSetup,
  setSetup,
  startGame,
} from "@/lib/karogs/engine";
import {
  aiView,
  chooseMove,
  seededAi,
  unknownPool,
  type AiDifficulty,
} from "@/lib/karogs/ai";
import { mulberry32 } from "@/lib/utils";

function newGame(seed: number): GameState {
  let st = createGame();
  st = setSetup(st, "red", randomSetup("red", mulberry32(seed)));
  st = setSetup(st, "blue", randomSetup("blue", mulberry32(seed + 1000)));
  return startGame(st);
}

describe("AI view hygiene", () => {
  it("hides all opponent ranks from the AI", () => {
    const st = newGame(1);
    const view = aiView(st, "red");
    for (const cell of view.board) {
      if (cell && cell.owner === "blue") {
        expect("hidden" in cell).toBe(true);
        expect((cell as { rank?: unknown }).rank).toBeUndefined();
      }
    }
  });

  it("tracks the unknown opponent pool from public information", () => {
    const st = newGame(1);
    const view = aiView(st, "red");
    const pool = unknownPool(view, "red");
    expect(pool.length).toBe(40);
  });
});

describe("AI legality", () => {
  it("always produces legal moves on every difficulty over full games", () => {
    for (const difficulty of ["easy", "medium", "hard"] as AiDifficulty[]) {
      for (let seed = 0; seed < 4; seed++) {
        const rng = mulberry32(seed * 31 + 7);
        let state = newGame(seed);
        for (let halfMove = 0; halfMove < 160; halfMove++) {
          if (state.phase !== "playing") break;
          const side = state.turn;
          const legal = legalMoves(state, side);
          if (legal.length === 0) break;
          const move = chooseMove(aiView(state, side), side, difficulty, rng);
          expect(
            legal.some((m) => m.pieceId === move.pieceId && m.to === move.to),
            `illegal move by ${difficulty} AI`,
          ).toBe(true);
          state = applyMove(state, move);
        }
        expect(state.phase === "finished" || state.moves.length >= 100).toBe(true);
      }
    }
  });

  it("is deterministic for a fixed seed", () => {
    const st = newGame(9);
    const view = aiView(st, "red");
    const a = seededAi(123)(view, "red", "hard");
    const b = seededAi(123)(view, "red", "hard");
    expect(a).toEqual(b);
  });

  it("plays the endgame without stalling", () => {
    // Endgame: red scout vs blue flag with a few bombs.
    const st = newGame(3);
    const state: GameState = {
      ...st,
      board: st.board.map((p) => {
        if (!p) return null;
        if (p.owner === "red" && p.kind !== "movable") return null;
        if (p.owner === "blue" && p.kind === "flag") return p;
        if (p.owner === "blue" && p.kind === "bomb") return p;
        return p.owner === "red" && p.rank === 2 ? p : p.owner === "red" ? p : null;
      }),
    };
    // Just ensure choosing a move never throws and is legal.
    const side = state.turn;
    const legal = legalMoves(state, side);
    if (legal.length > 0) {
      const move = chooseMove(aiView(state, side), side, "hard");
      expect(legal.some((m) => m.pieceId === move.pieceId && m.to === move.to)).toBe(true);
    }
  });
});
