// Server-authoritative multiplayer logic. Runs only on the server.

import crypto from "node:crypto";
import {
  type GameState,
  type Piece,
  type Side,
  applyMove,
  allRevealed,
  createGame,
  deserializeGame,
  redactFor,
  resign,
  serializeGame,
  setSetup,
  startGame,
} from "@/lib/karogs/engine";
import type { MpStore } from "./store";
import {
  type ActionResponse,
  type CreateRoomResponse,
  type DbGame,
  type JoinRoomResponse,
  type PlayerAction,
  type PlayerActionType,
  type StateView,
  ABANDON_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  validateNickname,
} from "./types";

export class MultiplayerError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hashToken(token: string): string {
  const salt = process.env.PLAYER_TOKEN_SALT ?? "lingo-karogs-v1";
  return crypto.createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function randomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    chars.push(
      ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)],
    );
  }
  return chars.join("");
}

function sideForToken(db: DbGame, tokenHash: string): Side | null {
  if (db.redTokenHash === tokenHash) return "red";
  if (db.blueTokenHash === tokenHash) return "blue";
  return null;
}

interface ActionPatch {
  stateJson?: string;
  status?: DbGame["status"];
  winner?: DbGame["winner"];
  endReason?: string | null;
  readyRed?: boolean;
  readyBlue?: boolean;
  lastActionIds?: string[];
  lastActionAt?: string;
  rematchWithCode?: string | null;
  updatedAt?: string;
}

export class MultiplayerService {
  constructor(private store: MpStore) {}

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = randomCode();
      const existing = await this.store.getGameByCode(code);
      if (!existing) return code;
    }
    throw new MultiplayerError(500, "code-generation", "Neizdevās izveidot kodu");
  }

  async createRoom(params: {
    nickname: string;
    guestHash: string;
    playerToken: string;
  }): Promise<CreateRoomResponse> {
    const nickname = validateNickname(params.nickname);
    const tokenHash = hashToken(params.playerToken);
    const id = crypto.randomUUID();
    const code = await this.uniqueCode();
    const now = new Date().toISOString();
    const db: DbGame = {
      id,
      code,
      status: "waiting",
      hostTokenHash: tokenHash,
      guestTokenHash: null,
      redTokenHash: tokenHash,
      blueTokenHash: null,
      redNickname: nickname,
      blueNickname: null,
      hostGuestHash: params.guestHash,
      guestGuestHash: null,
      stateJson: serializeGame(createGame()),
      version: 0,
      readyRed: false,
      readyBlue: false,
      lastActionIds: [],
      lastActionAt: now,
      winner: null,
      endReason: null,
      rematchOf: null,
      rematchWithCode: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.createGame(db);
    return {
      gameId: id,
      code,
      playerToken: params.playerToken,
      inviteUrl: `/karogs/${code}`,
    };
  }

  async joinRoom(params: {
    code: string;
    nickname: string;
    guestHash: string;
    playerToken: string;
  }): Promise<JoinRoomResponse> {
    const nickname = validateNickname(params.nickname);
    const tokenHash = hashToken(params.playerToken);
    for (let attempt = 0; attempt < 3; attempt++) {
      const db = await this.store.getGameByCode(params.code);
      if (!db) {
        throw new MultiplayerError(404, "room-not-found", "Istaba nav atrasta");
      }
      const known = sideForToken(db, tokenHash);
      if (known) {
        return {
          gameId: db.id,
          code: db.code,
          playerToken: params.playerToken,
          side: known,
        };
      }
      if (db.status === "waiting" && !db.guestTokenHash) {
        const updated = await this.store.updateIfVersion(db.id, db.version, {
          version: db.version + 1,
          guestTokenHash: tokenHash,
          blueTokenHash: tokenHash,
          blueNickname: nickname,
          guestGuestHash: params.guestHash,
          status: "setup",
          lastActionAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (!updated) continue;
        return {
          gameId: db.id,
          code: db.code,
          playerToken: params.playerToken,
          side: "blue",
        };
      }
      throw new MultiplayerError(
        409,
        "room-full",
        db.status === "waiting"
          ? "Istaba vēl nav pieejama"
          : "Istaba ir pilna; šim uzaicinājumam nepieciešams savs spēlētāja identifikators",
      );
    }
    throw new MultiplayerError(409, "conflict", "Mēģini vēlreiz");
  }

  async getView(gameId: string, playerToken: string): Promise<StateView> {
    const db = await this.store.getGame(gameId);
    if (!db) throw new MultiplayerError(404, "room-not-found", "Istaba nav atrasta");
    const side = sideForToken(db, hashToken(playerToken));
    if (!side) {
      throw new MultiplayerError(403, "unauthorized", "Nepareizs spēlētāja identifikators");
    }
    return buildView(db, side);
  }

  async action(
    gameId: string,
    playerToken: string,
    action: PlayerAction,
  ): Promise<StateView> {
    const tokenHash = hashToken(playerToken);
    for (let attempt = 0; attempt < 4; attempt++) {
      const db = await this.store.getGame(gameId);
      if (!db) {
        throw new MultiplayerError(404, "room-not-found", "Istaba nav atrasta");
      }
      const side = sideForToken(db, tokenHash);
      if (!side) {
        throw new MultiplayerError(
          403,
          "unauthorized",
          "Nepareizs spēlētāja identifikators",
        );
      }
      if (db.lastActionIds.includes(action.actionId)) {
        return buildView(db, side);
      }

      if (action.type === "rematch") {
        const updated = await this.performRematch(db, side);
        return buildView(updated, side);
      }

      const patch = this.computePatch(db, side, action);
      const updated = await this.store.updateIfVersion(gameId, db.version, {
        ...patch,
        version: db.version + 1,
      });
      if (!updated) continue;
      await this.maybeRecordResult(updated);
      return buildView(updated, side);
    }
    throw new MultiplayerError(
      409,
      "conflict",
      "Vienlaicīgs pieprasījums — mēģini vēlreiz",
    );
  }

  private computePatch(
    db: DbGame,
    side: Side,
    action: PlayerAction,
  ): ActionPatch {
    const now = new Date().toISOString();
    const base: ActionPatch = {
      lastActionIds: [...db.lastActionIds.slice(-19), action.actionId],
      lastActionAt: now,
      updatedAt: now,
    };
    const state = deserializeGame(db.stateJson);

    switch (action.type as PlayerActionType) {
      case "deploy": {
        if (db.status !== "setup" || state.phase !== "setup") {
          throw new MultiplayerError(400, "bad-phase", "Izvietošana vairs nav iespējama");
        }
        if (!action.payload.placement || typeof action.payload.placement !== "object") {
          throw new MultiplayerError(400, "bad-payload", "Trūkst armijas izvietojuma");
        }
        const next = setSetup(
          state,
          side,
          action.payload.placement as Record<number, Piece>,
        );
        return {
          ...base,
          stateJson: serializeGame(next),
          // Re-deploying only un-readies the player who changed their army.
          readyRed: side === "red" ? false : db.readyRed,
          readyBlue: side === "blue" ? false : db.readyBlue,
        };
      }
      case "ready": {
        if (db.status !== "setup") {
          throw new MultiplayerError(400, "bad-phase", "Spēle jau ir sākta");
        }
        if (!state.setups[side]) {
          throw new MultiplayerError(400, "no-setup", "Vispirms izvieto savu armiju");
        }
        const readyRed = side === "red" ? true : db.readyRed;
        const readyBlue = side === "blue" ? true : db.readyBlue;
        if (readyRed && readyBlue) {
          const started = startGame(state);
          return {
            ...base,
            stateJson: serializeGame(started),
            status: "playing",
            readyRed: true,
            readyBlue: true,
          };
        }
        return { ...base, readyRed, readyBlue };
      }
      case "move": {
        if (db.status !== "playing" || state.phase !== "playing") {
          throw new MultiplayerError(400, "bad-phase", "Spēle nav sākta");
        }
        if (
          typeof action.payload.pieceId !== "string" ||
          typeof action.payload.to !== "number"
        ) {
          throw new MultiplayerError(400, "bad-payload", "Nederīgs gājiens");
        }
        const next = applyMove(state, {
          pieceId: action.payload.pieceId,
          to: action.payload.to,
        });
        if (next.phase === "finished") {
          return {
            ...base,
            stateJson: serializeGame(next),
            status: "finished",
            winner: next.winner,
            endReason: next.endReason,
          };
        }
        return { ...base, stateJson: serializeGame(next) };
      }
      case "resign": {
        if (db.status !== "playing") {
          throw new MultiplayerError(400, "bad-phase", "Spēle nav sākta");
        }
        const next = resign(state, side);
        return {
          ...base,
          stateJson: serializeGame(next),
          status: "finished",
          winner: next.winner,
          endReason: next.endReason,
        };
      }
      case "cancel": {
        if (db.status !== "waiting") {
          throw new MultiplayerError(400, "bad-phase", "Istabu nevar atcelt");
        }
        return {
          ...base,
          status: "finished",
          winner: null,
          endReason: "cancelled",
        };
      }
      case "claim-abandon": {
        if (db.status !== "playing") {
          throw new MultiplayerError(400, "bad-phase", "Spēle nav sākta");
        }
        if (!db.guestTokenHash) {
          throw new MultiplayerError(400, "no-opponent", "Pretinieks nav pievienojies");
        }
        const idle = Date.now() - Date.parse(db.lastActionAt);
        if (idle < ABANDON_MS) {
          throw new MultiplayerError(
            400,
            "too-early",
            "Pretinieks vēl nav pazudis — vari pieteikt uzvaru pēc 15 minūtēm",
          );
        }
        const next: GameState = {
          ...state,
          phase: "finished",
          winner: side,
          endReason: "abandoned",
          endedAt: Date.now(),
        };
        return {
          ...base,
          stateJson: serializeGame(next),
          status: "finished",
          winner: side,
          endReason: "abandoned",
        };
      }
      default:
        throw new MultiplayerError(400, "bad-action", "Nezināma darbība");
    }
  }

  private async performRematch(db: DbGame, side: Side): Promise<DbGame> {
    if (db.status !== "finished") {
      throw new MultiplayerError(400, "bad-phase", "Revanšs iespējams tikai pēc spēles beigām");
    }
    if (db.rematchWithCode) return db;
    const opponentHash = side === "red" ? db.blueTokenHash : db.redTokenHash;
    if (!opponentHash) {
      throw new MultiplayerError(400, "no-opponent", "Nav pretinieka");
    }
    const id = crypto.randomUUID();
    const code = await this.uniqueCode();
    const now = new Date().toISOString();
    const myHash = side === "red" ? db.redTokenHash : db.blueTokenHash;
    // Sides are swapped for the rematch.
    const newDb: DbGame = {
      id,
      code,
      status: "setup",
      hostTokenHash: myHash ?? db.hostTokenHash,
      guestTokenHash: opponentHash,
      redTokenHash: side === "red" ? opponentHash : myHash,
      blueTokenHash: side === "red" ? myHash : opponentHash,
      redNickname: side === "red" ? db.blueNickname : db.redNickname,
      blueNickname: side === "red" ? db.redNickname : db.blueNickname,
      hostGuestHash: side === "red" ? db.guestGuestHash ?? "" : db.hostGuestHash,
      guestGuestHash: side === "red" ? db.hostGuestHash : db.guestGuestHash ?? "",
      stateJson: serializeGame(createGame()),
      version: 0,
      readyRed: false,
      readyBlue: false,
      lastActionIds: [],
      lastActionAt: now,
      winner: null,
      endReason: null,
      rematchOf: db.id,
      rematchWithCode: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.createGame(newDb);
    const updated = await this.store.updateIfVersion(db.id, db.version, {
      version: db.version + 1,
      rematchWithCode: code,
      updatedAt: now,
    });
    return updated ?? db;
  }

  private async maybeRecordResult(db: DbGame): Promise<void> {
    if (db.status !== "finished" || !db.redTokenHash || !db.blueTokenHash) return;
    const state = deserializeGame(db.stateJson);
    try {
      await this.store.insertResult({
        gameId: db.id,
        winnerSide: db.winner ?? "draw",
        winnerGuestHash:
          db.winner === "red"
            ? db.hostGuestHash
            : db.winner === "blue"
              ? db.guestGuestHash
              : null,
        redGuestHash: db.hostGuestHash,
        blueGuestHash: db.guestGuestHash ?? "",
        redNickname: db.redNickname,
        blueNickname: db.blueNickname,
        moves: state.moves.length,
        durationSec: Math.max(
          0,
          Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 1000),
        ),
        endReason: db.endReason ?? "unknown",
      });
    } catch {
      // Duplicate result insert must not fail the action.
    }
  }
}

export function buildView(db: DbGame, side: Side): StateView {
  const state = deserializeGame(db.stateJson);
  const playing = db.status === "playing";
  const finished = db.status === "finished";
  const idle = Date.now() - Date.parse(db.lastActionAt);
  return {
    gameId: db.id,
    code: db.code,
    status: db.status,
    yourSide: side,
    yourNickname: side === "red" ? db.redNickname : db.blueNickname,
    players: {
      red: {
        nickname: db.redNickname,
        ready: db.readyRed,
        connected: !!db.redTokenHash,
      },
      blue: {
        nickname: db.blueNickname,
        ready: db.readyBlue,
        connected: !!db.blueTokenHash,
      },
    },
    phase: state.phase,
    turn: state.turn,
    board:
      finished
        ? allRevealed(state)
        : playing
          ? redactFor(state, side)
          : null,
    moves: state.moves,
    captured: state.captured,
    winner: state.winner,
    endReason: state.endReason,
    yourSetup: db.status === "setup" ? state.setups[side] : null,
    ready: side === "red" ? db.readyRed : db.readyBlue,
    lastActionAt: db.lastActionAt,
    claimable:
      playing && !!db.guestTokenHash && idle > ABANDON_MS,
    rematchCode: db.rematchWithCode,
    version: db.version,
  };
}

export function toActionResponse(error: unknown): ActionResponse {
  if (error instanceof MultiplayerError) {
    return { ok: false, code: error.code, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, code: "internal", error: error.message };
  }
  return { ok: false, code: "internal", error: "Nezināma kļūda" };
}
