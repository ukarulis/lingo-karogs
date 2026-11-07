import { describe, expect, it } from "vitest";
import {
  type GameState,
  type Piece,
  type Side,
  ARMY,
  ARMY_SIZE,
  KarogsError,
  applyMove,
  createArmy,
  createGame,
  deserializeGame,
  emptyBoard,
  legalMoves,
  positionSignature,
  randomSetup,
  redactFor,
  resign,
  serializeGame,
  setSetup,
  startGame,
} from "@/lib/karogs/engine";
import { mulberry32 } from "@/lib/utils";

function piece(
  owner: Side,
  rank: number | "bomb" | "flag",
  id: string,
): Piece {
  const kind =
    rank === "bomb" ? "bomb" : rank === "flag" ? "flag" : "movable";
  return {
    id,
    owner,
    kind,
    rank: rank === "bomb" || rank === "flag" ? null : rank,
    redSees: owner === "red",
    blueSees: owner === "blue",
  };
}

function playingState(
  red: Array<[number, Piece]>,
  blue: Array<[number, Piece]>,
  turn: Side = "red",
  overrides: Partial<GameState> = {},
): GameState {
  const board = emptyBoard();
  for (const [cell, p] of red) board[cell] = p;
  for (const [cell, p] of blue) board[cell] = p;
  return {
    phase: "playing",
    turn,
    board,
    setups: { red: null, blue: null },
    captured: { red: 0, blue: 0 },
    moves: [],
    noCaptureHalfMoves: 0,
    positionCounts: {},
    pieceLastMoves: {},
    winner: null,
    endReason: null,
    startedAt: 0,
    endedAt: null,
    ...overrides,
  };
}

describe("army construction", () => {
  it("builds exactly 40 pieces with the standard inventory", () => {
    for (const side of ["red", "blue"] as Side[]) {
      const army = createArmy(side);
      expect(army.length).toBe(ARMY_SIZE);
      const counts = new Map<string, number>();
      for (const p of army) {
        const key = `${p.kind}:${p.rank}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const entry of ARMY) {
        const rank =
          entry.rank === "bomb" || entry.rank === "flag" ? null : entry.rank;
        const key = `${entry.kind}:${rank}`;
        expect(counts.get(key)).toBe(entry.count);
      }
      expect(new Set(army.map((p) => p.id)).size).toBe(ARMY_SIZE);
    }
  });

  it("generates a valid random setup inside the deployment zone", () => {
    for (const side of ["red", "blue"] as Side[]) {
      const setup = randomSetup(side, mulberry32(42));
      expect(Object.keys(setup).length).toBe(ARMY_SIZE);
      for (const [cell, p] of Object.entries(setup)) {
        const y = Math.floor(Number(cell) / 10);
        expect(p.owner).toBe(side);
        expect(side === "red" ? y >= 6 : y <= 3).toBe(true);
      }
    }
  });
});

describe("setup validation", () => {
  const valid = () => randomSetup("red", mulberry32(1));

  it("accepts a full valid army", () => {
    const st = setSetup(createGame(), "red", valid());
    expect(st.setups.red).not.toBeNull();
  });

  it("rejects invalid setups", () => {
    const base = createGame();
    const full = valid();
    // too few pieces
    const short = { ...full };
    delete short[Number(Object.keys(short)[0])];
    expect(() => setSetup(base, "red", short)).toThrowError(KarogsError);
    // outside zone
    const outside = { ...full };
    const key = Object.keys(outside)[0];
    outside[40] = outside[Number(key)];
    delete outside[Number(key)];
    expect(() => setSetup(base, "red", outside)).toThrowError(KarogsError);
    // duplicate piece
    const dup: Record<number, Piece> = {};
    const entries = Object.entries(full);
    for (let i = 0; i < entries.length; i++) {
      const [cell, p] = entries[i];
      dup[Number(cell)] = i === 0 ? entries[1][1] : p;
    }
    expect(() => setSetup(base, "red", dup)).toThrowError(KarogsError);
    // wrong owner
    const enemy = { ...full };
    const k = Object.keys(enemy)[0];
    enemy[Number(k)] = { ...enemy[Number(k)], owner: "blue" };
    expect(() => setSetup(base, "red", enemy)).toThrowError(KarogsError);
  });

  it("does not start without both armies", () => {
    const st = setSetup(createGame(), "red", valid());
    expect(() => startGame(st)).toThrowError(KarogsError);
  });

  it("starts with red to move", () => {
    let st = createGame();
    st = setSetup(st, "red", randomSetup("red", mulberry32(1)));
    st = setSetup(st, "blue", randomSetup("blue", mulberry32(2)));
    const started = startGame(st);
    expect(started.phase).toBe("playing");
    expect(started.turn).toBe("red");
  });
});

describe("movement rules", () => {
  const redScout = piece("red", 2, "red-2-0");
  const redMarshal = piece("red", 10, "red-10-0");
  const blueCaptain = piece("blue", 6, "blue-6-0");

  it("moves one square orthogonally, never diagonally", () => {
    const st = playingState([[60, redMarshal]], [[11, blueCaptain]]);
    expect(() => applyMove(st, { pieceId: "red-10-0", to: 71 })).toThrowError(
      KarogsError,
    ); // diagonal
    expect(() => applyMove(st, { pieceId: "red-10-0", to: 40 })).toThrowError(
      KarogsError,
    ); // two squares
    const next = applyMove(st, { pieceId: "red-10-0", to: 61 });
    expect(next.board[61]?.id).toBe("red-10-0");
    expect(next.turn).toBe("blue");
  });

  it("lets scouts run in straight lines but not through blockers or lakes", () => {
    const scout = redScout;
    const st = playingState(
      [[60, scout], [62, piece("red", 5, "red-5-0")]],
      [[10, blueCaptain]],
    );
    // straight line up: 60 -> 50 legal, 40 lake blocked, 30 blocked by own piece at 62? no.
    const moves = legalMoves(st, "red").filter((m) => m.pieceId === scout.id);
    expect(moves.map((m) => m.to)).toContain(50);
    expect(moves.map((m) => m.to)).toContain(40);
    expect(moves.map((m) => m.to)).toContain(30);
    expect(moves.map((m) => m.to)).toContain(20);
    expect(moves.map((m) => m.to)).toContain(10); // attack on the blue captain
    expect(moves.map((m) => m.to)).not.toContain(0); // blocked by the captain
    // blocked to the right by own piece
    expect(moves.map((m) => m.to)).not.toContain(63);
    expect(moves.map((m) => m.to)).toContain(61);
    // straight down
    expect(moves.map((m) => m.to)).toContain(70);
    expect(moves.map((m) => m.to)).toContain(90);
  });

  it("keeps bombs and flags stationary", () => {
    const bomb = piece("red", "bomb", "red-bomb-0");
    const flag = piece("red", "flag", "red-flag-0");
    const st = playingState(
      [[60, bomb], [61, flag]],
      [[11, blueCaptain]],
    );
    expect(
      legalMoves(st, "red").filter((m) => m.pieceId === "red-bomb-0"),
    ).toHaveLength(0);
    expect(
      legalMoves(st, "red").filter((m) => m.pieceId === "red-flag-0"),
    ).toHaveLength(0);
  });

  it("enforces turn order", () => {
    const st = playingState([[60, redMarshal]], [[11, blueCaptain]], "red");
    expect(() => applyMove(st, { pieceId: "blue-6-0", to: 12 })).toThrowError(
      KarogsError,
    );
  });
});

describe("combat", () => {
  it("removes both pieces on equal ranks", () => {
    const a = piece("red", 6, "red-6-0");
    const b = piece("blue", 6, "blue-6-0");
    const st = playingState([[60, a]], [[50, b]]);
    const next = applyMove(st, { pieceId: "red-6-0", to: 50 });
    expect(next.board[50]).toBeNull();
    expect(next.captured.red).toBe(1);
    expect(next.captured.blue).toBe(1);
  });

  it("stronger rank wins, weaker attacker dies", () => {
    const marshal = piece("red", 10, "red-10-0");
    const captain = piece("blue", 6, "blue-6-0");
    const st = playingState([[60, marshal]], [[50, captain]]);
    const next = applyMove(st, { pieceId: "red-10-0", to: 50 });
    expect(next.board[50]?.id).toBe("red-10-0");
    expect(next.captured.blue).toBe(1);

    const redCaptain = piece("red", 6, "red-6-0");
    const blueMarshal = piece("blue", 10, "blue-10-0");
    const st2 = playingState([[60, redCaptain]], [[50, blueMarshal]], "red");
    const next2 = applyMove(st2, { pieceId: "red-6-0", to: 50 });
    expect(next2.board[50]?.id).toBe("blue-10-0");
    expect(next2.captured.red).toBe(1);
  });

  it("miner defuses a bomb; others die on bombs", () => {
    const miner = piece("red", 3, "red-3-0");
    const marshal = piece("red", 10, "red-10-0");
    const bomb = piece("blue", "bomb", "blue-bomb-0");
    const st = playingState([[60, miner]], [[50, bomb]]);
    const next = applyMove(st, { pieceId: "red-3-0", to: 50 });
    expect(next.board[50]?.id).toBe("red-3-0");
    expect(next.captured.blue).toBe(1);

    const st2 = playingState([[60, marshal]], [[50, bomb]]);
    const next2 = applyMove(st2, { pieceId: "red-10-0", to: 50 });
    expect(next2.board[50]?.id).toBe("blue-bomb-0");
    expect(next2.captured.red).toBe(1);
  });

  it("spy defeats the marshal only when attacking", () => {
    const spy = piece("red", 1, "red-1-0");
    const marshal = piece("blue", 10, "blue-10-0");
    const st = playingState([[60, spy]], [[50, marshal]]);
    const next = applyMove(st, { pieceId: "red-1-0", to: 50 });
    expect(next.board[50]?.id).toBe("red-1-0");
    expect(next.captured.blue).toBe(1);

    const st2 = playingState([[60, spy]], [[50, marshal]], "blue");
    const next2 = applyMove(st2, { pieceId: "blue-10-0", to: 60 });
    expect(next2.board[60]?.id).toBe("blue-10-0");
    expect(next2.captured.red).toBe(1);
  });

  it("capturing the flag ends the game", () => {
    const scout = piece("red", 2, "red-2-0");
    const flag = piece("blue", "flag", "blue-flag-0");
    const st = playingState([[64, scout]], [[34, flag]]);
    const next = applyMove(st, { pieceId: "red-2-0", to: 34 });
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe("red");
    expect(next.endReason).toBe("flag-captured");
  });
});

describe("anti-chasing, draws and end conditions", () => {
  it("blocks the third consecutive two-square oscillation", () => {
    const redPiece = piece("red", 4, "red-4-0");
    const bluePiece = piece("blue", 4, "blue-4-0");
    const st = playingState([[80, redPiece]], [[10, bluePiece]], "red");
    let s = applyMove(st, { pieceId: "red-4-0", to: 81 });
    s = applyMove(s, { pieceId: "blue-4-0", to: 11 });
    s = applyMove(s, { pieceId: "red-4-0", to: 80 });
    s = applyMove(s, { pieceId: "blue-4-0", to: 10 });
    expect(() => applyMove(s, { pieceId: "red-4-0", to: 81 })).toThrowError(
      KarogsError,
    );
  });

  it("declares defeat when a player has no legal moves", () => {
    const redPiece = piece("red", 10, "red-10-0");
    const blueFlag = piece("blue", "flag", "blue-flag-0");
    const blueBomb = piece("blue", "bomb", "blue-bomb-0");
    const st = playingState([[80, redPiece]], [[10, blueFlag], [11, blueBomb]], "red");
    const next = applyMove(st, { pieceId: "red-10-0", to: 81 });
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe("red");
    expect(next.endReason).toBe("no-legal-moves");
  });

  it("declares a draw after 120 half-moves without captures", () => {
    const redPiece = piece("red", 4, "red-4-0");
    const bluePiece = piece("blue", 4, "blue-4-0");
    const st = playingState(
      [[80, redPiece]],
      [[10, bluePiece]],
      "red",
      { noCaptureHalfMoves: 119 },
    );
    const next = applyMove(st, { pieceId: "red-4-0", to: 81 });
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe("draw");
    expect(next.endReason).toBe("no-capture");
  });

  it("declares a draw on the third repetition of a position", () => {
    const redPiece = piece("red", 4, "red-4-0");
    const bluePiece = piece("blue", 4, "blue-4-0");
    const st = playingState([[80, redPiece]], [[10, bluePiece]], "red");
    // Simulate the post-move position having already occurred twice.
    const boardAfter = [...st.board];
    boardAfter[81] = boardAfter[80];
    boardAfter[80] = null;
    const key = positionSignature(boardAfter, "blue");
    const prepared = { ...st, positionCounts: { [key]: 2 } };
    const next = applyMove(prepared, { pieceId: "red-4-0", to: 81 });
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe("draw");
    expect(next.endReason).toBe("repetition");
  });

  it("handles resignation", () => {
    const st = playingState([[80, piece("red", 4, "red-4-0")]], [[10, piece("blue", 4, "blue-4-0")]], "red");
    const next = resign(st, "red");
    expect(next.winner).toBe("blue");
    expect(next.endReason).toBe("resignation");
  });
});

describe("hidden information", () => {
  it("redacts opponent ranks before combat and reveals after", () => {
    const marshal = piece("red", 10, "red-10-0");
    const captain = piece("blue", 6, "blue-6-0");
    const st = playingState([[60, marshal]], [[50, captain]]);
    const blueView = redactFor(st, "blue");
    expect("hidden" in (blueView[60] as Piece)).toBe(true);
    expect((blueView[50] as Piece).rank).toBe(6);
    const next = applyMove(st, { pieceId: "red-10-0", to: 50 });
    const blueViewAfter = redactFor(next, "blue");
    const redPieceAt50 = blueViewAfter[50];
    expect("hidden" in (redPieceAt50 as Piece)).toBe(false);
    expect((redPieceAt50 as Piece).rank).toBe(10);
  });

  it("never reveals hidden identities in serialized state views", () => {
    const st = playingState(
      [[60, piece("red", 10, "red-10-0")]],
      [[50, piece("blue", 6, "blue-6-0")]],
    );
    const view = redactFor(st, "blue");
    const json = JSON.stringify(view);
    expect(json).not.toContain('"rank":10');
  });
});

describe("serialization", () => {
  it("roundtrips a game state and resumes play", () => {
    const st = playingState(
      [[80, piece("red", 4, "red-4-0")]],
      [[10, piece("blue", 4, "blue-4-0")]],
    );
    const moved = applyMove(st, { pieceId: "red-4-0", to: 81 });
    const restored = deserializeGame(serializeGame(moved));
    expect(restored.turn).toBe("blue");
    const continued = applyMove(restored, { pieceId: "blue-4-0", to: 11 });
    expect(continued.turn).toBe("red");
    expect(continued.moves.length).toBe(2);
  });

  it("rejects corrupt state", () => {
    expect(() => deserializeGame("not json")).toThrow();
    expect(() => deserializeGame('{"board":[]}')).toThrow();
  });
});
