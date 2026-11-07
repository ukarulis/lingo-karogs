import type { DbGame, LeaderboardRow } from "./types";

export interface GameResultRow {
  gameId: string;
  winnerSide: "red" | "blue" | "draw";
  winnerGuestHash: string | null;
  redGuestHash: string;
  blueGuestHash: string;
  redNickname: string | null;
  blueNickname: string | null;
  moves: number;
  durationSec: number;
  endReason: string;
}

export interface MpStore {
  createGame(game: DbGame): Promise<DbGame>;
  getGame(id: string): Promise<DbGame | null>;
  getGameByCode(code: string): Promise<DbGame | null>;
  /** Atomic optimistic update; returns null when the version does not match. */
  updateIfVersion(
    id: string,
    version: number,
    patch: Partial<DbGame>,
  ): Promise<DbGame | null>;
  insertResult(result: GameResultRow): Promise<void>;
  leaderboard(limit: number): Promise<LeaderboardRow[]>;
  close?(): void;
}
