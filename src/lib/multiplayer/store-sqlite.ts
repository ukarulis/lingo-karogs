// Local/dev multiplayer store. Used for local development and the
// automated test suite. Never the production store.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DbGame, GameStatus, LeaderboardRow } from "./types";
import type { GameResultRow, MpStore } from "./store";

function resolveDbPath(): string {
  const configured = process.env.SQLITE_DB_PATH;
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const name = configured ? path.basename(configured) : "lingo-karogs.db";
  return path.join(dir, /* turbopackIgnore: true */ name);
}

const rowToGame = (row: Record<string, unknown>): DbGame => ({
  id: row.id as string,
  code: row.code as string,
  status: row.status as GameStatus,
  hostTokenHash: row.host_token_hash as string,
  guestTokenHash: (row.guest_token_hash as string | null) ?? null,
  redTokenHash: (row.red_token_hash as string | null) ?? null,
  blueTokenHash: (row.blue_token_hash as string | null) ?? null,
  redNickname: (row.red_nickname as string | null) ?? null,
  blueNickname: (row.blue_nickname as string | null) ?? null,
  hostGuestHash: row.host_guest_hash as string,
  guestGuestHash: (row.guest_guest_hash as string | null) ?? null,
  stateJson: row.state_json as string,
  version: row.version as number,
  readyRed: !!row.ready_red,
  readyBlue: !!row.ready_blue,
  lastActionIds: JSON.parse((row.last_action_ids as string) || "[]") as string[],
  lastActionAt: row.last_action_at as string,
  winner: (row.winner as DbGame["winner"]) ?? null,
  endReason: (row.end_reason as string | null) ?? null,
  rematchOf: (row.rematch_of as string | null) ?? null,
  rematchWithCode: (row.rematch_with_code as string | null) ?? null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export class SqliteMpStore implements MpStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? resolveDbPath());
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        host_token_hash TEXT NOT NULL,
        guest_token_hash TEXT,
        red_token_hash TEXT,
        blue_token_hash TEXT,
        red_nickname TEXT,
        blue_nickname TEXT,
        host_guest_hash TEXT NOT NULL,
        guest_guest_hash TEXT,
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        ready_red INTEGER NOT NULL DEFAULT 0,
        ready_blue INTEGER NOT NULL DEFAULT 0,
        last_action_ids TEXT NOT NULL DEFAULT '[]',
        last_action_at TEXT NOT NULL,
        winner TEXT,
        end_reason TEXT,
        rematch_of TEXT,
        rematch_with_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL UNIQUE,
        winner_side TEXT NOT NULL,
        winner_guest_hash TEXT,
        red_guest_hash TEXT NOT NULL,
        blue_guest_hash TEXT NOT NULL,
        red_nickname TEXT,
        blue_nickname TEXT,
        moves INTEGER NOT NULL,
        duration_sec INTEGER NOT NULL,
        end_reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
      CREATE INDEX IF NOT EXISTS idx_results_winner ON results(winner_guest_hash);
    `);
  }

  async createGame(game: DbGame): Promise<DbGame> {
    this.db
      .prepare(
        `INSERT INTO games (id, code, status, host_token_hash, guest_token_hash,
          red_token_hash, blue_token_hash, red_nickname, blue_nickname,
          host_guest_hash, guest_guest_hash, state_json, version,
          ready_red, ready_blue, last_action_ids, last_action_at, winner,
          end_reason, rematch_of, rematch_with_code, created_at, updated_at)
         VALUES (@id, @code, @status, @hostTokenHash, @guestTokenHash,
          @redTokenHash, @blueTokenHash, @redNickname, @blueNickname,
          @hostGuestHash, @guestGuestHash, @stateJson, @version,
          @readyRed, @readyBlue, @lastActionIds, @lastActionAt, @winner,
          @endReason, @rematchOf, @rematchWithCode, @createdAt, @updatedAt)`,
      )
      .run({
        ...game,
        readyRed: game.readyRed ? 1 : 0,
        readyBlue: game.readyBlue ? 1 : 0,
        lastActionIds: JSON.stringify(game.lastActionIds),
      });
    return game;
  }

  async getGame(id: string): Promise<DbGame | null> {
    const row = this.db.prepare("SELECT * FROM games WHERE id = ?").get(id);
    return row ? rowToGame(row as Record<string, unknown>) : null;
  }

  async getGameByCode(code: string): Promise<DbGame | null> {
    const row = this.db
      .prepare("SELECT * FROM games WHERE code = ?")
      .get(code.trim().toUpperCase());
    return row ? rowToGame(row as Record<string, unknown>) : null;
  }

  async updateIfVersion(
    id: string,
    version: number,
    patch: Partial<DbGame>,
  ): Promise<DbGame | null> {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id, version };
    const map: Record<string, string> = {
      version: "version",
      status: "status",
      guestTokenHash: "guest_token_hash",
      redTokenHash: "red_token_hash",
      blueTokenHash: "blue_token_hash",
      redNickname: "red_nickname",
      blueNickname: "blue_nickname",
      guestGuestHash: "guest_guest_hash",
      stateJson: "state_json",
      readyRed: "ready_red",
      readyBlue: "ready_blue",
      lastActionIds: "last_action_ids",
      lastActionAt: "last_action_at",
      winner: "winner",
      endReason: "end_reason",
      rematchOf: "rematch_of",
      rematchWithCode: "rematch_with_code",
      updatedAt: "updated_at",
    };
    for (const [key, column] of Object.entries(map)) {
      const k = key as keyof DbGame;
      if (patch[k] === undefined) continue;
      let value: unknown = patch[k];
      if (k === "readyRed" || k === "readyBlue") value = value ? 1 : 0;
      if (k === "lastActionIds") value = JSON.stringify(value);
      if (k === "version") {
        fields.push(`${column} = @newVersion`);
        values.newVersion = value;
      } else {
        fields.push(`${column} = @${k}`);
        values[k] = value;
      }
    }
    if (fields.length === 0) return this.getGame(id);
    if (patch.version === undefined) fields.push("version = version + 1");
    const result = this.db
      .prepare(
        `UPDATE games SET ${fields.join(", ")} WHERE id = @id AND version = @version`,
      )
      .run(values);
    if (result.changes === 0) return null;
    return this.getGame(id);
  }

  async insertResult(result: GameResultRow): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO results (id, game_id, winner_side, winner_guest_hash,
          red_guest_hash, blue_guest_hash, red_nickname, blue_nickname,
          moves, duration_sec, end_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        result.gameId,
        result.winnerSide,
        result.winnerGuestHash,
        result.redGuestHash,
        result.blueGuestHash,
        result.redNickname,
        result.blueNickname,
        result.moves,
        result.durationSec,
        result.endReason,
        new Date().toISOString(),
      );
  }

  async leaderboard(limit: number): Promise<LeaderboardRow[]> {
    const rows = this.db
      .prepare(
        `SELECT
           COALESCE(r.nickname, 'Anonīms') AS nickname,
           r.guest_hash AS guest_hash,
           SUM(CASE WHEN winner_side = r.side THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN winner_side <> r.side AND winner_side <> 'draw' THEN 1 ELSE 0 END) AS losses,
           SUM(CASE WHEN winner_side = 'draw' THEN 1 ELSE 0 END) AS draws,
           COUNT(*) AS games
         FROM (
           SELECT red_guest_hash AS guest_hash, red_nickname AS nickname, winner_side, 'red' AS side FROM results
           UNION ALL
           SELECT blue_guest_hash AS guest_hash, blue_nickname AS nickname, winner_side, 'blue' AS side FROM results
         ) r
         GROUP BY r.guest_hash, r.nickname
         ORDER BY wins DESC, games ASC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      nickname: string;
      wins: number;
      losses: number;
      draws: number;
      games: number;
    }>;
    return rows.map((r) => ({
      nickname: r.nickname,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      games: r.games,
      points: r.wins * 3 + r.draws,
    }));
  }

  close(): void {
    this.db.close();
  }
}
