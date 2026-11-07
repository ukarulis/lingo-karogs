import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteMpStore } from "@/lib/multiplayer/store-sqlite";
import {
  type MpStore,
} from "@/lib/multiplayer/store";
import {
  MultiplayerError,
  MultiplayerService,
} from "@/lib/multiplayer/service";
import type { StateView } from "@/lib/multiplayer/types";
import { randomSetup } from "@/lib/karogs/engine";
import { mulberry32 } from "@/lib/utils";

let tmpDir: string;
let store: MpStore;
let service: MultiplayerService;

const HOST = "token-host-0001";
const GUEST = "token-guest-0001";

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lk-mp-test-"));
  store = new SqliteMpStore(path.join(tmpDir, "test.db"));
  service = new MultiplayerService(store);
});

afterAll(() => {
  store.close?.();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupPlayingGame(): Promise<{
  gameId: string;
  code: string;
  redView: StateView;
  blueView: StateView;
}> {
  const created = await service.createRoom({
    nickname: "Sarkanais",
    guestHash: "host-guest-hash",
    playerToken: HOST,
  });
  const joined = await service.joinRoom({
    code: created.code,
    nickname: "Zilais",
    guestHash: "guest-guest-hash",
    playerToken: GUEST,
  });
  expect(joined.side).toBe("blue");
  await service.action(created.gameId, HOST, {
    actionId: crypto.randomUUID(),
    type: "deploy",
    payload: { placement: randomSetup("red", mulberry32(5)) },
  });
  await service.action(created.gameId, GUEST, {
    actionId: crypto.randomUUID(),
    type: "deploy",
    payload: { placement: randomSetup("blue", mulberry32(6)) },
  });
  await service.action(created.gameId, HOST, {
    actionId: crypto.randomUUID(),
    type: "ready",
    payload: {},
  });
  await service.action(created.gameId, GUEST, {
    actionId: crypto.randomUUID(),
    type: "ready",
    payload: {},
  });
  return {
    gameId: created.gameId,
    code: created.code,
    redView: await service.getView(created.gameId, HOST),
    blueView: await service.getView(created.gameId, GUEST),
  };
}

describe("room lifecycle", () => {
  it("creates a room, joins it and enforces roles", async () => {
    const created = await service.createRoom({
      nickname: "Anna",
      guestHash: "g-a",
      playerToken: "token-a-0001",
    });
    expect(created.code).toMatch(/^[A-Z0-9]{6}$/);
    const view = await service.getView(created.gameId, "token-a-0001");
    expect(view.status).toBe("waiting");
    expect(view.yourSide).toBe("red");

    const joined = await service.joinRoom({
      code: created.code,
      nickname: "Bērziņš",
      guestHash: "g-b",
      playerToken: "token-b-0001",
    });
    expect(joined.side).toBe("blue");
    const viewAfter = await service.getView(created.gameId, "token-a-0001");
    expect(viewAfter.status).toBe("setup");
  });

  it("rejects duplicate joins and unknown tokens", async () => {
    const created = await service.createRoom({
      nickname: "Cilvēks",
      guestHash: "g-c",
      playerToken: "token-c-0001",
    });
    await service.joinRoom({
      code: created.code,
      nickname: "Draugs",
      guestHash: "g-d",
      playerToken: "token-d-0001",
    });
    await expect(
      service.joinRoom({
        code: created.code,
        nickname: "Trešais",
        guestHash: "g-e",
        playerToken: "token-e-0001",
      }),
    ).rejects.toMatchObject({ code: "room-full" });
    await expect(
      service.getView(created.gameId, "token-f-0001"),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("lets players reconnect with their own token", async () => {
    const created = await service.createRoom({
      nickname: "Atgriezējs",
      guestHash: "g-r",
      playerToken: "token-r-0001",
    });
    const again = await service.joinRoom({
      code: created.code,
      nickname: "Atgriezējs",
      guestHash: "g-r",
      playerToken: "token-r-0001",
    });
    expect(again.side).toBe("red");
  });
});

describe("hidden-state protection", () => {
  it("never sends opponent identities to players", async () => {
    const { redView, blueView } = await setupPlayingGame();
    expect(redView.board).toHaveLength(100);
    for (const cell of redView.board ?? []) {
      if (cell && cell.owner === "blue") {
        expect("hidden" in cell).toBe(true);
        expect((cell as { rank?: unknown }).rank).toBeUndefined();
      }
    }
    for (const cell of blueView.board ?? []) {
      if (cell && cell.owner === "red") {
        expect("hidden" in cell).toBe(true);
      }
    }
    const blueCells = (redView.board ?? []).filter((c) => c && c.owner === "blue");
    expect(blueCells.length).toBe(40);
    expect(blueCells.every((c) => "hidden" in (c as object))).toBe(true);
  });
});

describe("server-authoritative actions", () => {
  it("rejects out-of-turn moves", async () => {
    const { gameId, blueView } = await setupPlayingGame();
    const bluePiece = blueView.board?.find(
      (c) => c && c.owner === "blue" && !("hidden" in c) && c.kind === "movable",
    );
    expect(bluePiece).toBeTruthy();
    await expect(
      service.action(gameId, GUEST, {
        actionId: crypto.randomUUID(),
        type: "move",
        payload: { pieceId: (bluePiece as { id: string }).id, to: 99 },
      }),
    ).rejects.toMatchObject({ code: "wrong-turn" });
  });

  it("rejects illegal moves and invalid deployments", async () => {
    const { gameId, redView } = await setupPlayingGame();
    const redPiece = redView.board?.find(
      (c) =>
        c &&
        c.owner === "red" &&
        !("hidden" in c) &&
        c.kind === "movable",
    );
    expect(redPiece).toBeTruthy();
    await expect(
      service.action(gameId, HOST, {
        actionId: crypto.randomUUID(),
        type: "move",
        payload: { pieceId: (redPiece as { id: string }).id, to: 0 },
      }),
    ).rejects.toMatchObject({ code: "illegal-move" });

    // Bad deployment on a fresh room.
    const created = await service.createRoom({
      nickname: "Kļūdīgais",
      guestHash: "g-x",
      playerToken: "token-x-0001",
    });
    await service.joinRoom({
      code: created.code,
      nickname: "Otrs",
      guestHash: "g-y",
      playerToken: "token-y-0001",
    });
    const short = randomSetup("red", mulberry32(9));
    const firstKey = Number(Object.keys(short)[0]);
    delete short[firstKey];
    await expect(
      service.action(created.gameId, "token-x-0001", {
        actionId: crypto.randomUUID(),
        type: "deploy",
        payload: { placement: short },
      }),
    ).rejects.toMatchObject({ code: "bad-army" });
  });

  it("applies a legal move and is idempotent on retries", async () => {
    const { gameId, redView } = await setupPlayingGame();
    const redPiece = redView.board?.find(
      (c) =>
        c &&
        c.owner === "red" &&
        !("hidden" in c) &&
        c.kind === "movable",
    );
    const piece = redPiece as { id: string };
    const idx = (redView.board as Array<{ id?: string }>).findIndex(
      (c) => c?.id === piece.id,
    );
    const candidates = [idx - 10, idx + 10, idx - 1, idx + 1].filter(
      (t) =>
        t >= 0 &&
        t < 100 &&
        Math.abs((t % 10) - (idx % 10)) <= 1 &&
        redView.board?.[t] === null,
    );
    const to = candidates[0];
    const actionId = crypto.randomUUID();
    const first = await service.action(gameId, HOST, {
      actionId,
      type: "move",
      payload: { pieceId: piece.id, to },
    });
    expect(first.moves.length).toBe(1);
    const retry = await service.action(gameId, HOST, {
      actionId,
      type: "move",
      payload: { pieceId: piece.id, to },
    });
    expect(retry.moves.length).toBe(1);
  });

  it("serializes conflicting version updates atomically", async () => {
    const { gameId } = await setupPlayingGame();
    const db = await (store as SqliteMpStore).getGame(gameId);
    expect(db).toBeTruthy();
    const patch = { updatedAt: new Date().toISOString() };
    const first = await store.updateIfVersion(gameId, db!.version, patch);
    const second = await store.updateIfVersion(gameId, db!.version, patch);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});

describe("results, rematch and abandonment", () => {
  it("records a server-verified result on resignation", async () => {
    const { gameId, redView } = await setupPlayingGame();
    const finished = await service.action(gameId, HOST, {
      actionId: crypto.randomUUID(),
      type: "resign",
      payload: {},
    });
    expect(finished.status).toBe("finished");
    expect(finished.winner).toBe("blue");
    expect(finished.endReason).toBe("resignation");
    const board = await store.leaderboard(50);
    expect(board.length).toBeGreaterThanOrEqual(2);
    const blue = board.find((r) => r.nickname === "Zilais");
    expect(blue?.wins).toBe(1);
    void redView;
  });

  it("creates a rematch with swapped sides", async () => {
    const { gameId, code } = await setupPlayingGame();
    await service.action(gameId, HOST, {
      actionId: crypto.randomUUID(),
      type: "resign",
      payload: {},
    });
    const afterRematch = await service.action(gameId, GUEST, {
      actionId: crypto.randomUUID(),
      type: "rematch",
      payload: {},
    });
    expect(afterRematch.rematchCode).toBeTruthy();
    const blueJoin = await service.joinRoom({
      code: afterRematch.rematchCode!,
      nickname: "Zilais",
      guestHash: "guest-guest-hash",
      playerToken: GUEST,
    });
    expect(blueJoin.side).toBe("red"); // sides swapped
    const redJoin = await service.joinRoom({
      code: afterRematch.rematchCode!,
      nickname: "Sarkanais",
      guestHash: "host-guest-hash",
      playerToken: HOST,
    });
    expect(redJoin.side).toBe("blue");
    void code;
  });

  it("awards the win when the opponent abandons the game", async () => {
    const { gameId } = await setupPlayingGame();
    const db = await (store as SqliteMpStore).getGame(gameId);
    await store.updateIfVersion(gameId, db!.version, {
      lastActionAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    const claimed = await service.action(gameId, HOST, {
      actionId: crypto.randomUUID(),
      type: "claim-abandon",
      payload: {},
    });
    expect(claimed.status).toBe("finished");
    expect(claimed.winner).toBe("red");
    expect(claimed.endReason).toBe("abandoned");
  });
});

describe("error contract", () => {
  it("exposes structured errors", async () => {
    try {
      await service.getView("no-such-game", HOST);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MultiplayerError);
      expect((err as MultiplayerError).status).toBe(404);
      expect((err as MultiplayerError).code).toBe("room-not-found");
    }
  });
});
