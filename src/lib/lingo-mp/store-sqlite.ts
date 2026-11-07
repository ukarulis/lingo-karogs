// Local/dev Lingo multiplayer store. Used for local development and the
// automated test suite. Never the production store.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { LingoMpStore } from "./store";
import type {
  LingoMpDbEvent,
  LingoMpDbMatch,
  LingoMpDbResult,
  LingoMpDbRound,
  LingoMpDbSubmission,
} from "./store";

function resolveDbPath(): string {
  const configured = process.env.SQLITE_DB_PATH;
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const name = configured ? path.basename(configured) : "lingo-karogs.db";
  return path.join(dir, /* turbopackIgnore: true */ name);
}

const bool = (v: unknown): boolean => !!v;

export class SqliteLingoMpStore implements LingoMpStore {
  private db: Database.Database;
  private rateBuckets = new Map<string, number[]>();

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? resolveDbPath());
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lingo_matches (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        config_json TEXT NOT NULL,
        targets_json TEXT NOT NULL,
        host_token_hash TEXT NOT NULL,
        guest_token_hash TEXT,
        host_nickname TEXT,
        guest_nickname TEXT,
        host_guest_hash TEXT NOT NULL,
        guest_guest_hash TEXT,
        host_ready INTEGER NOT NULL DEFAULT 0,
        guest_ready INTEGER NOT NULL DEFAULT 0,
        countdown_ends_at TEXT,
        match_started_at TEXT,
        current_round_index INTEGER NOT NULL DEFAULT 0,
        round_started_at TEXT,
        next_round_started_at TEXT,
        host_deadline_at TEXT,
        guest_deadline_at TEXT,
        host_extensions_left INTEGER NOT NULL DEFAULT 0,
        guest_extensions_left INTEGER NOT NULL DEFAULT 0,
        host_extensions_used_round INTEGER NOT NULL DEFAULT 0,
        guest_extensions_used_round INTEGER NOT NULL DEFAULT 0,
        winner TEXT,
        end_reason TEXT,
        result_json TEXT,
        rematch_requested_host INTEGER NOT NULL DEFAULT 0,
        rematch_requested_guest INTEGER NOT NULL DEFAULT 0,
        rematch_of TEXT,
        rematch_with_code TEXT,
        version INTEGER NOT NULL DEFAULT 0,
        last_action_ids TEXT NOT NULL DEFAULT '[]',
        last_action_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lingo_match_rounds (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        round_index INTEGER NOT NULL,
        word TEXT NOT NULL,
        started_at TEXT,
        next_start_at TEXT,
        base_deadline_at TEXT,
        host_deadline_at TEXT,
        guest_deadline_at TEXT,
        host_outcome TEXT NOT NULL,
        guest_outcome TEXT NOT NULL,
        host_score INTEGER NOT NULL DEFAULT 0,
        guest_score INTEGER NOT NULL DEFAULT 0,
        host_solved_at TEXT,
        guest_solved_at TEXT,
        host_extensions_used INTEGER NOT NULL DEFAULT 0,
        guest_extensions_used INTEGER NOT NULL DEFAULT 0,
        resolved_at TEXT,
        UNIQUE(match_id, round_index)
      );
      CREATE TABLE IF NOT EXISTS lingo_round_submissions (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL,
        player TEXT NOT NULL,
        seq INTEGER NOT NULL,
        word TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(round_id, player, seq)
      );
      CREATE TABLE IF NOT EXISTS lingo_match_events (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        action_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        player TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lingo_match_results (
        match_id TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lingo_matches_code ON lingo_matches(code);
      CREATE INDEX IF NOT EXISTS idx_lingo_rounds_match ON lingo_match_rounds(match_id);
      CREATE INDEX IF NOT EXISTS idx_lingo_subs_round ON lingo_round_submissions(round_id);
      CREATE INDEX IF NOT EXISTS idx_lingo_events_match ON lingo_match_events(match_id);
      CREATE TABLE IF NOT EXISTS lingo_schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    this.db
      .prepare(
        "INSERT OR IGNORE INTO lingo_schema_versions (version, applied_at) VALUES (1, ?)",
      )
      .run(new Date().toISOString());
  }

  async createMatch(match: LingoMpDbMatch): Promise<LingoMpDbMatch> {
    this.db
      .prepare(
        `INSERT INTO lingo_matches (id, code, format, status, config_json,
          targets_json, host_token_hash, guest_token_hash, host_nickname,
          guest_nickname, host_guest_hash, guest_guest_hash, host_ready,
          guest_ready, countdown_ends_at, match_started_at,
          current_round_index, round_started_at, next_round_started_at,
          host_deadline_at, guest_deadline_at, host_extensions_left,
          guest_extensions_left, host_extensions_used_round,
          guest_extensions_used_round, winner, end_reason, result_json,
          rematch_requested_host, rematch_requested_guest, rematch_of,
          rematch_with_code, version, last_action_ids, last_action_at,
          created_at, updated_at, expires_at)
         VALUES (@id, @code, @format, @status, @configJson, @targetsJson,
          @hostTokenHash, @guestTokenHash, @hostNickname, @guestNickname,
          @hostGuestHash, @guestGuestHash, @hostReady, @guestReady,
          @countdownEndsAt, @matchStartedAt, @currentRoundIndex,
          @roundStartedAt, @nextRoundStartedAt, @hostDeadlineAt,
          @guestDeadlineAt, @hostExtensionsLeft, @guestExtensionsLeft,
          @hostExtensionsUsedRound, @guestExtensionsUsedRound, @winner,
          @endReason, @resultJson, @rematchRequestedHost,
          @rematchRequestedGuest, @rematchOf, @rematchWithCode, @version,
          @lastActionIds, @lastActionAt, @createdAt, @updatedAt, @expiresAt)`,
      )
      .run({
        ...match,
        hostReady: match.hostReady ? 1 : 0,
        guestReady: match.guestReady ? 1 : 0,
        rematchRequestedHost: match.rematchRequestedHost ? 1 : 0,
        rematchRequestedGuest: match.rematchRequestedGuest ? 1 : 0,
        lastActionIds: JSON.stringify(match.lastActionIds),
      });
    for (let i = 0; i < JSON.parse(match.targetsJson).length; i++) {
      await this.upsertRound({
        id: `${match.id}:r${i}`,
        matchId: match.id,
        roundIndex: i,
        word: (JSON.parse(match.targetsJson) as string[])[i],
        startedAt: null,
        nextStartAt: null,
        baseDeadlineAt: null,
        hostDeadlineAt: null,
        guestDeadlineAt: null,
        hostOutcome: "playing",
        guestOutcome: "playing",
        hostScore: 0,
        guestScore: 0,
        hostSolvedAt: null,
        guestSolvedAt: null,
        hostExtensionsUsed: 0,
        guestExtensionsUsed: 0,
        resolvedAt: null,
      });
    }
    return match;
  }

  async getMatch(id: string): Promise<LingoMpDbMatch | null> {
    const row = this.db
      .prepare("SELECT * FROM lingo_matches WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToMatch(row) : null;
  }

  async getMatchByCode(code: string): Promise<LingoMpDbMatch | null> {
    const row = this.db
      .prepare("SELECT * FROM lingo_matches WHERE code = ?")
      .get(code.trim().toUpperCase()) as Record<string, unknown> | undefined;
    return row ? this.rowToMatch(row) : null;
  }

  async updateIfVersion(
    id: string,
    version: number,
    patch: Partial<LingoMpDbMatch>,
  ): Promise<LingoMpDbMatch | null> {
    const map: Record<string, string> = {
      status: "status",
      guestTokenHash: "guest_token_hash",
      hostNickname: "host_nickname",
      guestNickname: "guest_nickname",
      guestGuestHash: "guest_guest_hash",
      hostReady: "host_ready",
      guestReady: "guest_ready",
      countdownEndsAt: "countdown_ends_at",
      matchStartedAt: "match_started_at",
      currentRoundIndex: "current_round_index",
      roundStartedAt: "round_started_at",
      nextRoundStartedAt: "next_round_started_at",
      hostDeadlineAt: "host_deadline_at",
      guestDeadlineAt: "guest_deadline_at",
      hostExtensionsLeft: "host_extensions_left",
      guestExtensionsLeft: "guest_extensions_left",
      hostExtensionsUsedRound: "host_extensions_used_round",
      guestExtensionsUsedRound: "guest_extensions_used_round",
      winner: "winner",
      endReason: "end_reason",
      resultJson: "result_json",
      rematchRequestedHost: "rematch_requested_host",
      rematchRequestedGuest: "rematch_requested_guest",
      rematchOf: "rematch_of",
      rematchWithCode: "rematch_with_code",
      lastActionIds: "last_action_ids",
      lastActionAt: "last_action_at",
      updatedAt: "updated_at",
      expiresAt: "expires_at",
    };
    const fields: string[] = [];
    const values: Record<string, unknown> = { id, version };
    for (const [key, column] of Object.entries(map)) {
      const k = key as keyof LingoMpDbMatch;
      if (patch[k] === undefined) continue;
      let value: unknown = patch[k];
      if (k === "hostReady" || k === "guestReady" ||
          k === "rematchRequestedHost" || k === "rematchRequestedGuest") {
        value = value ? 1 : 0;
      }
      if (k === "lastActionIds") value = JSON.stringify(value);
      fields.push(`${column} = @${k}`);
      values[k] = value;
    }
    if (fields.length === 0) return this.getMatch(id);
    fields.push("version = version + 1");
    const result = this.db
      .prepare(
        `UPDATE lingo_matches SET ${fields.join(", ")} WHERE id = @id AND version = @version`,
      )
      .run(values);
    if (result.changes === 0) return null;
    return this.getMatch(id);
  }

  async getRounds(matchId: string): Promise<LingoMpDbRound[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM lingo_match_rounds WHERE match_id = ? ORDER BY round_index",
      )
      .all(matchId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      matchId: row.match_id as string,
      roundIndex: row.round_index as number,
      word: row.word as string,
      startedAt: (row.started_at as string | null) ?? null,
      nextStartAt: (row.next_start_at as string | null) ?? null,
      baseDeadlineAt: (row.base_deadline_at as string | null) ?? null,
      hostDeadlineAt: (row.host_deadline_at as string | null) ?? null,
      guestDeadlineAt: (row.guest_deadline_at as string | null) ?? null,
      hostOutcome: row.host_outcome as LingoMpDbRound["hostOutcome"],
      guestOutcome: row.guest_outcome as LingoMpDbRound["guestOutcome"],
      hostScore: row.host_score as number,
      guestScore: row.guest_score as number,
      hostSolvedAt: (row.host_solved_at as string | null) ?? null,
      guestSolvedAt: (row.guest_solved_at as string | null) ?? null,
      hostExtensionsUsed: row.host_extensions_used as number,
      guestExtensionsUsed: row.guest_extensions_used as number,
      resolvedAt: (row.resolved_at as string | null) ?? null,
    }));
  }

  async getSubmissions(matchId: string): Promise<LingoMpDbSubmission[]> {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM lingo_round_submissions s
         JOIN lingo_match_rounds r ON r.id = s.round_id
         WHERE r.match_id = ? ORDER BY s.seq`,
      )
      .all(matchId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      roundId: row.round_id as string,
      player: row.player as LingoMpDbSubmission["player"],
      seq: row.seq as number,
      word: row.word as string,
      resultJson: row.result_json as string,
      createdAt: row.created_at as string,
    }));
  }

  async getEvents(matchId: string): Promise<LingoMpDbEvent[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM lingo_match_events WHERE match_id = ? ORDER BY created_at",
      )
      .all(matchId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      matchId: row.match_id as string,
      actionId: row.action_id as string,
      type: row.type as string,
      player: row.player as LingoMpDbEvent["player"],
      payloadJson: row.payload_json as string,
      createdAt: row.created_at as string,
    }));
  }

  async upsertRound(round: LingoMpDbRound): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO lingo_match_rounds (id, match_id, round_index, word,
          started_at, next_start_at, base_deadline_at, host_deadline_at,
          guest_deadline_at, host_outcome, guest_outcome, host_score,
          guest_score, host_solved_at, guest_solved_at, host_extensions_used,
          guest_extensions_used, resolved_at)
         VALUES (@id, @matchId, @roundIndex, @word, @startedAt, @nextStartAt,
          @baseDeadlineAt, @hostDeadlineAt, @guestDeadlineAt, @hostOutcome,
          @guestOutcome, @hostScore, @guestScore, @hostSolvedAt,
          @guestSolvedAt, @hostExtensionsUsed, @guestExtensionsUsed,
          @resolvedAt)
         ON CONFLICT(id) DO UPDATE SET
          started_at = excluded.started_at,
          next_start_at = excluded.next_start_at,
          base_deadline_at = excluded.base_deadline_at,
          host_deadline_at = excluded.host_deadline_at,
          guest_deadline_at = excluded.guest_deadline_at,
          host_outcome = excluded.host_outcome,
          guest_outcome = excluded.guest_outcome,
          host_score = excluded.host_score,
          guest_score = excluded.guest_score,
          host_solved_at = excluded.host_solved_at,
          guest_solved_at = excluded.guest_solved_at,
          host_extensions_used = excluded.host_extensions_used,
          guest_extensions_used = excluded.guest_extensions_used,
          resolved_at = excluded.resolved_at`,
      )
      .run(round);
  }

  async insertSubmission(submission: LingoMpDbSubmission): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO lingo_round_submissions (id, round_id, player,
          seq, word, result_json, created_at)
         VALUES (@id, @roundId, @player, @seq, @word, @resultJson, @createdAt)`,
      )
      .run(submission);
  }

  async insertEvent(event: LingoMpDbEvent): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO lingo_match_events (id, match_id, action_id,
          type, player, payload_json, created_at)
         VALUES (@id, @matchId, @actionId, @type, @player, @payloadJson, @createdAt)`,
      )
      .run(event);
  }

  async insertResult(result: LingoMpDbResult): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO lingo_match_results (match_id, result_json, created_at)
         VALUES (@matchId, @resultJson, @createdAt)`,
      )
      .run(result);
  }

  async transaction<T>(fn: (tx: LingoMpStore) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  }

  async rateLimit(
    bucket: string,
    max: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    let hits = this.rateBuckets.get(bucket);
    if (!hits) {
      hits = [];
      this.rateBuckets.set(bucket, hits);
    }
    const fresh = hits.filter((t) => now - t < windowMs);
    if (fresh.length >= max) {
      this.rateBuckets.set(bucket, fresh);
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - fresh[0])) / 1000)),
      };
    }
    fresh.push(now);
    this.rateBuckets.set(bucket, fresh);
    return { allowed: true, retryAfterSec: 0 };
  }

  async ping(): Promise<boolean> {
    try {
      this.db.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  }

  async schemaVersion(): Promise<number> {
    const row = this.db
      .prepare("SELECT MAX(version) AS v FROM lingo_schema_versions")
      .get() as { v: number | null };
    return row.v ?? 0;
  }

  async migrate(): Promise<void> {
    // The constructor applies the idempotent schema and records version 1.
  }

  private rowToMatch(row: Record<string, unknown>): LingoMpDbMatch {
    return {
      id: row.id as string,
      code: row.code as string,
      format: row.format as LingoMpDbMatch["format"],
      status: row.status as LingoMpDbMatch["status"],
      configJson: row.config_json as string,
      targetsJson: row.targets_json as string,
      hostTokenHash: row.host_token_hash as string,
      guestTokenHash: (row.guest_token_hash as string | null) ?? null,
      hostNickname: (row.host_nickname as string | null) ?? null,
      guestNickname: (row.guest_nickname as string | null) ?? null,
      hostGuestHash: row.host_guest_hash as string,
      guestGuestHash: (row.guest_guest_hash as string | null) ?? null,
      hostReady: bool(row.host_ready),
      guestReady: bool(row.guest_ready),
      countdownEndsAt: (row.countdown_ends_at as string | null) ?? null,
      matchStartedAt: (row.match_started_at as string | null) ?? null,
      currentRoundIndex: row.current_round_index as number,
      roundStartedAt: (row.round_started_at as string | null) ?? null,
      nextRoundStartedAt: (row.next_round_started_at as string | null) ?? null,
      hostDeadlineAt: (row.host_deadline_at as string | null) ?? null,
      guestDeadlineAt: (row.guest_deadline_at as string | null) ?? null,
      hostExtensionsLeft: row.host_extensions_left as number,
      guestExtensionsLeft: row.guest_extensions_left as number,
      hostExtensionsUsedRound: row.host_extensions_used_round as number,
      guestExtensionsUsedRound: row.guest_extensions_used_round as number,
      winner: (row.winner as LingoMpDbMatch["winner"]) ?? null,
      endReason: (row.end_reason as string | null) ?? null,
      resultJson: (row.result_json as string | null) ?? null,
      rematchRequestedHost: bool(row.rematch_requested_host),
      rematchRequestedGuest: bool(row.rematch_requested_guest),
      rematchOf: (row.rematch_of as string | null) ?? null,
      rematchWithCode: (row.rematch_with_code as string | null) ?? null,
      version: row.version as number,
      lastActionIds: JSON.parse((row.last_action_ids as string) || "[]") as string[],
      lastActionAt: row.last_action_at as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      expiresAt: row.expires_at as string,
    };
  }

  close(): void {
    this.db.close();
  }
}
