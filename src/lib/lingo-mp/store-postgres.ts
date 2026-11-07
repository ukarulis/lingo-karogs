// Production Lingo multiplayer store backed by a direct PostgreSQL
// connection (DigitalOcean Managed PostgreSQL, Supabase Postgres or any
// standard PostgreSQL). Server-side only; uses pooled connections and real
// transactions for related writes.

import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import type {
  LingoMpDbEvent,
  LingoMpDbMatch,
  LingoMpDbResult,
  LingoMpDbRound,
  LingoMpDbSubmission,
  LingoMpStore,
} from "./store";

const MIGRATIONS = [
  path.resolve(process.cwd(), "migrations-postgres", "0001_lingo_init.sql"),
];

const rowToMatch = (row: Record<string, unknown>): LingoMpDbMatch => ({
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
  hostReady: !!row.host_ready,
  guestReady: !!row.guest_ready,
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
  rematchRequestedHost: !!row.rematch_requested_host,
  rematchRequestedGuest: !!row.rematch_requested_guest,
  rematchOf: (row.rematch_of as string | null) ?? null,
  rematchWithCode: (row.rematch_with_code as string | null) ?? null,
  version: row.version as number,
  lastActionIds: (row.last_action_ids as string[]) ?? [],
  lastActionAt: row.last_action_at as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  expiresAt: row.expires_at as string,
});

export class PostgresLingoMpStore implements LingoMpStore {
  private pool: Pool;

  constructor() {
    const rawUrl = process.env.LINGO_MP_DATABASE_URL;
    if (!rawUrl) {
      throw new Error(
        "Postgres Lingo store requires LINGO_MP_DATABASE_URL",
      );
    }
    let ssl: boolean | { rejectUnauthorized: boolean; ca?: Buffer };
    if (process.env.LINGO_MP_SSL === "disable") {
      ssl = false;
    } else {
      const sslConfig: { rejectUnauthorized: boolean; ca?: Buffer } = {
        rejectUnauthorized: true,
      };
      const caFile = process.env.LINGO_MP_SSL_CA_FILE;
      if (caFile) {
        sslConfig.ca = fs.readFileSync(
          path.resolve(/* turbopackIgnore: true */ process.cwd(), caFile),
        );
      }
      ssl = sslConfig;
    }
    // node-postgres treats sslmode=* as a verify alias and ignores the
    // explicit ssl option; strip it so the CA below governs verification.
    const url = new URL(rawUrl);
    url.searchParams.delete("sslmode");
    this.pool = new Pool({
      connectionString: url.toString(),
      ssl,
      max: Number(process.env.LINGO_MP_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    this.pool.on("error", (err) => {
      console.error(
        JSON.stringify({
          scope: "lingo-mp:pg",
          event: "pool-error",
          code: (err as { code?: string }).code ?? "unknown",
        }),
      );
    });
  }

  private async query(
    client: Pool | PoolClient,
    text: string,
    params: unknown[] = [],
  ) {
    return client.query(text, params);
  }

  async migrate(): Promise<void> {
    // The production runtime must not execute DDL during ordinary requests.
    // Migrations run explicitly via `scripts/migrate-lingo-db.mjs`; the
    // runtime only verifies the required schema version.
    if (process.env.LINGO_MP_AUTO_MIGRATE === "1") {
      for (const file of MIGRATIONS) {
        const sql = fs.readFileSync(/* turbopackIgnore: true */ file, "utf8");
        await this.pool.query(sql);
      }
      return;
    }
    const version = await this.schemaVersion();
    if (version < 1) {
      throw new Error(
        "Lingo schema missing: run scripts/migrate-lingo-db.mjs with a direct connection",
      );
    }
  }

  async createMatch(match: LingoMpDbMatch): Promise<LingoMpDbMatch> {
    await this.pool.query(
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
        $34,$35,$36,$37,$38)`,
      [
        match.id, match.code, match.format, match.status, match.configJson,
        match.targetsJson, match.hostTokenHash, match.guestTokenHash,
        match.hostNickname, match.guestNickname, match.hostGuestHash,
        match.guestGuestHash, match.hostReady, match.guestReady,
        match.countdownEndsAt, match.matchStartedAt, match.currentRoundIndex,
        match.roundStartedAt, match.nextRoundStartedAt, match.hostDeadlineAt,
        match.guestDeadlineAt, match.hostExtensionsLeft,
        match.guestExtensionsLeft, match.hostExtensionsUsedRound,
        match.guestExtensionsUsedRound, match.winner, match.endReason,
        match.resultJson, match.rematchRequestedHost,
        match.rematchRequestedGuest, match.rematchOf, match.rematchWithCode,
        match.version, JSON.stringify(match.lastActionIds), match.lastActionAt,
        match.createdAt, match.updatedAt, match.expiresAt,
      ],
    );
    await this.seedRounds(match);
    return match;
  }

  private async seedRounds(match: LingoMpDbMatch): Promise<void> {
    const targets = JSON.parse(match.targetsJson) as string[];
    for (let i = 0; i < targets.length; i++) {
      await this.upsertRound({
        id: `${match.id}:r${i}`,
        matchId: match.id,
        roundIndex: i,
        word: targets[i],
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
  }

  async getMatch(id: string): Promise<LingoMpDbMatch | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM lingo_matches WHERE id = $1",
      [id],
    );
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async getMatchByCode(code: string): Promise<LingoMpDbMatch | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM lingo_matches WHERE code = $1",
      [code.trim().toUpperCase()],
    );
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async updateIfVersion(
    id: string,
    version: number,
    patch: Partial<LingoMpDbMatch>,
  ): Promise<LingoMpDbMatch | null> {
    const map: Array<[keyof LingoMpDbMatch, string]> = [
      ["status", "status"],
      ["guestTokenHash", "guest_token_hash"],
      ["hostNickname", "host_nickname"],
      ["guestNickname", "guest_nickname"],
      ["guestGuestHash", "guest_guest_hash"],
      ["hostReady", "host_ready"],
      ["guestReady", "guest_ready"],
      ["countdownEndsAt", "countdown_ends_at"],
      ["matchStartedAt", "match_started_at"],
      ["currentRoundIndex", "current_round_index"],
      ["roundStartedAt", "round_started_at"],
      ["nextRoundStartedAt", "next_round_started_at"],
      ["hostDeadlineAt", "host_deadline_at"],
      ["guestDeadlineAt", "guest_deadline_at"],
      ["hostExtensionsLeft", "host_extensions_left"],
      ["guestExtensionsLeft", "guest_extensions_left"],
      ["hostExtensionsUsedRound", "host_extensions_used_round"],
      ["guestExtensionsUsedRound", "guest_extensions_used_round"],
      ["winner", "winner"],
      ["endReason", "end_reason"],
      ["resultJson", "result_json"],
      ["rematchRequestedHost", "rematch_requested_host"],
      ["rematchRequestedGuest", "rematch_requested_guest"],
      ["rematchOf", "rematch_of"],
      ["rematchWithCode", "rematch_with_code"],
      ["lastActionIds", "last_action_ids"],
      ["lastActionAt", "last_action_at"],
      ["updatedAt", "updated_at"],
      ["expiresAt", "expires_at"],
    ];
    const sets: string[] = ["version = version + 1"];
    const values: unknown[] = [id, version];
    let index = 3;
    for (const [key, column] of map) {
      if (patch[key] === undefined) continue;
      let value: unknown = patch[key];
      if (key === "lastActionIds") value = JSON.stringify(value);
      sets.push(`${column} = $${index}`);
      values.push(value);
      index++;
    }
    const { rows } = await this.pool.query(
      `UPDATE lingo_matches SET ${sets.join(", ")}
       WHERE id = $1 AND version = $2 RETURNING *`,
      values,
    );
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async getRounds(matchId: string): Promise<LingoMpDbRound[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM lingo_match_rounds WHERE match_id = $1 ORDER BY round_index",
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      roundIndex: row.round_index,
      word: row.word,
      startedAt: row.started_at ?? null,
      nextStartAt: row.next_start_at ?? null,
      baseDeadlineAt: row.base_deadline_at ?? null,
      hostDeadlineAt: row.host_deadline_at ?? null,
      guestDeadlineAt: row.guest_deadline_at ?? null,
      hostOutcome: row.host_outcome,
      guestOutcome: row.guest_outcome,
      hostScore: row.host_score,
      guestScore: row.guest_score,
      hostSolvedAt: row.host_solved_at ?? null,
      guestSolvedAt: row.guest_solved_at ?? null,
      hostExtensionsUsed: row.host_extensions_used,
      guestExtensionsUsed: row.guest_extensions_used,
      resolvedAt: row.resolved_at ?? null,
    }) as LingoMpDbRound);
  }

  async getSubmissions(matchId: string): Promise<LingoMpDbSubmission[]> {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.round_id, s.player, s.seq, s.word, s.result_json, s.created_at
       FROM lingo_round_submissions s
       WHERE s.match_id = $1 ORDER BY s.round_id, s.seq`,
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      roundId: row.round_id,
      player: row.player,
      seq: row.seq,
      word: row.word,
      resultJson: row.result_json,
      createdAt: row.created_at,
    })) as LingoMpDbSubmission[];
  }

  async getEvents(matchId: string): Promise<LingoMpDbEvent[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM lingo_match_events WHERE match_id = $1 ORDER BY created_at",
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      actionId: row.action_id,
      type: row.type,
      player: row.player,
      payloadJson: row.payload_json,
      createdAt: row.created_at,
    })) as LingoMpDbEvent[];
  }

  async upsertRound(round: LingoMpDbRound): Promise<void> {
    await this.pool.query(
      `INSERT INTO lingo_match_rounds (id, match_id, round_index, word,
        started_at, next_start_at, base_deadline_at, host_deadline_at,
        guest_deadline_at, host_outcome, guest_outcome, host_score,
        guest_score, host_solved_at, guest_solved_at, host_extensions_used,
        guest_extensions_used, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
        started_at = EXCLUDED.started_at,
        next_start_at = EXCLUDED.next_start_at,
        base_deadline_at = EXCLUDED.base_deadline_at,
        host_deadline_at = EXCLUDED.host_deadline_at,
        guest_deadline_at = EXCLUDED.guest_deadline_at,
        host_outcome = EXCLUDED.host_outcome,
        guest_outcome = EXCLUDED.guest_outcome,
        host_score = EXCLUDED.host_score,
        guest_score = EXCLUDED.guest_score,
        host_solved_at = EXCLUDED.host_solved_at,
        guest_solved_at = EXCLUDED.guest_solved_at,
        host_extensions_used = EXCLUDED.host_extensions_used,
        guest_extensions_used = EXCLUDED.guest_extensions_used,
        resolved_at = EXCLUDED.resolved_at`,
      [
        round.id, round.matchId, round.roundIndex, round.word, round.startedAt,
        round.nextStartAt, round.baseDeadlineAt, round.hostDeadlineAt,
        round.guestDeadlineAt, round.hostOutcome, round.guestOutcome,
        round.hostScore, round.guestScore, round.hostSolvedAt,
        round.guestSolvedAt, round.hostExtensionsUsed,
        round.guestExtensionsUsed, round.resolvedAt,
      ],
    );
  }

  async insertSubmission(submission: LingoMpDbSubmission): Promise<void> {
    await this.pool.query(
      `INSERT INTO lingo_round_submissions (id, match_id, round_id, player,
        seq, word, result_json, created_at)
       VALUES ($1, (SELECT match_id FROM lingo_match_rounds WHERE id = $2),
        $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        submission.id, submission.roundId, submission.player, submission.seq,
        submission.word, submission.resultJson, submission.createdAt,
      ],
    );
  }

  async insertEvent(event: LingoMpDbEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO lingo_match_events (id, match_id, action_id, type, player,
        payload_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        event.id, event.matchId, event.actionId, event.type, event.player,
        event.payloadJson, event.createdAt,
      ],
    );
  }

  async insertResult(result: LingoMpDbResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO lingo_match_results (match_id, result_json, created_at)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [result.matchId, result.resultJson, result.createdAt],
    );
  }

  async transaction<T>(fn: (tx: LingoMpStore) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx = new PostgresLingoMpStoreTx(client);
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection already terminated */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async rateLimit(
    bucket: string,
    max: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const windowMs = windowSec * 1000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const { rows } = await this.pool.query(
      `INSERT INTO lingo_rate_limits (bucket, window_start, hits)
       VALUES ($1, $2, 1)
       ON CONFLICT (bucket, window_start)
       DO UPDATE SET hits = lingo_rate_limits.hits + 1
       RETURNING hits`,
      [bucket, windowStart],
    );
    const hits = Number(rows[0]?.hits ?? 0);
    return {
      allowed: hits <= max,
      retryAfterSec: windowSec,
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async schemaVersion(): Promise<number> {
    const { rows } = await this.pool.query(
      "SELECT MAX(version) AS v FROM lingo_schema_versions",
    );
    return Number(rows[0]?.v ?? 0);
  }

  close(): void {
    void this.pool.end();
  }
}

/** Transactional handle sharing the checked-out client. */
class PostgresLingoMpStoreTx implements LingoMpStore {
  constructor(private client: PoolClient) {}

  private q(text: string, params: unknown[] = []) {
    return this.client.query(text, params);
  }

  async createMatch(match: LingoMpDbMatch): Promise<LingoMpDbMatch> {
    await this.q(
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
        $34,$35,$36,$37,$38)`,
      [
        match.id, match.code, match.format, match.status, match.configJson,
        match.targetsJson, match.hostTokenHash, match.guestTokenHash,
        match.hostNickname, match.guestNickname, match.hostGuestHash,
        match.guestGuestHash, match.hostReady, match.guestReady,
        match.countdownEndsAt, match.matchStartedAt, match.currentRoundIndex,
        match.roundStartedAt, match.nextRoundStartedAt, match.hostDeadlineAt,
        match.guestDeadlineAt, match.hostExtensionsLeft,
        match.guestExtensionsLeft, match.hostExtensionsUsedRound,
        match.guestExtensionsUsedRound, match.winner, match.endReason,
        match.resultJson, match.rematchRequestedHost,
        match.rematchRequestedGuest, match.rematchOf, match.rematchWithCode,
        match.version, JSON.stringify(match.lastActionIds), match.lastActionAt,
        match.createdAt, match.updatedAt, match.expiresAt,
      ],
    );
    const targets = JSON.parse(match.targetsJson) as string[];
    for (let i = 0; i < targets.length; i++) {
      await this.upsertRound({
        id: `${match.id}:r${i}`,
        matchId: match.id,
        roundIndex: i,
        word: targets[i],
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
    const { rows } = await this.q("SELECT * FROM lingo_matches WHERE id = $1", [id]);
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async getMatchByCode(code: string): Promise<LingoMpDbMatch | null> {
    const { rows } = await this.q("SELECT * FROM lingo_matches WHERE code = $1", [
      code.trim().toUpperCase(),
    ]);
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async updateIfVersion(
    id: string,
    version: number,
    patch: Partial<LingoMpDbMatch>,
  ): Promise<LingoMpDbMatch | null> {
    const sets: string[] = ["version = version + 1", "updated_at = now()"];
    const values: unknown[] = [id, version];
    let i = 3;
    const map: Array<[keyof LingoMpDbMatch, string]> = [
      ["status", "status"],
      ["guestTokenHash", "guest_token_hash"],
      ["hostNickname", "host_nickname"],
      ["guestNickname", "guest_nickname"],
      ["guestGuestHash", "guest_guest_hash"],
      ["hostReady", "host_ready"],
      ["guestReady", "guest_ready"],
      ["countdownEndsAt", "countdown_ends_at"],
      ["matchStartedAt", "match_started_at"],
      ["currentRoundIndex", "current_round_index"],
      ["roundStartedAt", "round_started_at"],
      ["nextRoundStartedAt", "next_round_started_at"],
      ["hostDeadlineAt", "host_deadline_at"],
      ["guestDeadlineAt", "guest_deadline_at"],
      ["hostExtensionsLeft", "host_extensions_left"],
      ["guestExtensionsLeft", "guest_extensions_left"],
      ["hostExtensionsUsedRound", "host_extensions_used_round"],
      ["guestExtensionsUsedRound", "guest_extensions_used_round"],
      ["winner", "winner"],
      ["endReason", "end_reason"],
      ["resultJson", "result_json"],
      ["rematchRequestedHost", "rematch_requested_host"],
      ["rematchRequestedGuest", "rematch_requested_guest"],
      ["rematchOf", "rematch_of"],
      ["rematchWithCode", "rematch_with_code"],
      ["lastActionIds", "last_action_ids"],
      ["lastActionAt", "last_action_at"],
      ["expiresAt", "expires_at"],
    ];
    for (const [key, column] of map) {
      if (patch[key] === undefined) continue;
      let value: unknown = patch[key];
      if (key === "lastActionIds") value = JSON.stringify(value);
      sets.push(`${column} = $${i}`);
      values.push(value);
      i++;
    }
    const { rows } = await this.q(
      `UPDATE lingo_matches SET ${sets.join(", ")}
       WHERE id = $1 AND version = $2 RETURNING *`,
      values,
    );
    return rows[0] ? rowToMatch(rows[0] as Record<string, unknown>) : null;
  }

  async getRounds(matchId: string): Promise<LingoMpDbRound[]> {
    const { rows } = await this.q(
      "SELECT * FROM lingo_match_rounds WHERE match_id = $1 ORDER BY round_index",
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      roundIndex: row.round_index,
      word: row.word,
      startedAt: row.started_at ?? null,
      nextStartAt: row.next_start_at ?? null,
      baseDeadlineAt: row.base_deadline_at ?? null,
      hostDeadlineAt: row.host_deadline_at ?? null,
      guestDeadlineAt: row.guest_deadline_at ?? null,
      hostOutcome: row.host_outcome,
      guestOutcome: row.guest_outcome,
      hostScore: row.host_score,
      guestScore: row.guest_score,
      hostSolvedAt: row.host_solved_at ?? null,
      guestSolvedAt: row.guest_solved_at ?? null,
      hostExtensionsUsed: row.host_extensions_used,
      guestExtensionsUsed: row.guest_extensions_used,
      resolvedAt: row.resolved_at ?? null,
    })) as LingoMpDbRound[];
  }

  async getSubmissions(matchId: string): Promise<LingoMpDbSubmission[]> {
    const { rows } = await this.q(
      `SELECT id, round_id, player, seq, word, result_json, created_at
       FROM lingo_round_submissions WHERE match_id = $1 ORDER BY round_id, seq`,
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      roundId: row.round_id,
      player: row.player,
      seq: row.seq,
      word: row.word,
      resultJson: row.result_json,
      createdAt: row.created_at,
    })) as LingoMpDbSubmission[];
  }

  async getEvents(matchId: string): Promise<LingoMpDbEvent[]> {
    const { rows } = await this.q(
      "SELECT * FROM lingo_match_events WHERE match_id = $1 ORDER BY created_at",
      [matchId],
    );
    return rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      actionId: row.action_id,
      type: row.type,
      player: row.player,
      payloadJson: row.payload_json,
      createdAt: row.created_at,
    })) as LingoMpDbEvent[];
  }

  async upsertRound(round: LingoMpDbRound): Promise<void> {
    await this.q(
      `INSERT INTO lingo_match_rounds (id, match_id, round_index, word,
        started_at, next_start_at, base_deadline_at, host_deadline_at,
        guest_deadline_at, host_outcome, guest_outcome, host_score,
        guest_score, host_solved_at, guest_solved_at, host_extensions_used,
        guest_extensions_used, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
        started_at = EXCLUDED.started_at,
        next_start_at = EXCLUDED.next_start_at,
        base_deadline_at = EXCLUDED.base_deadline_at,
        host_deadline_at = EXCLUDED.host_deadline_at,
        guest_deadline_at = EXCLUDED.guest_deadline_at,
        host_outcome = EXCLUDED.host_outcome,
        guest_outcome = EXCLUDED.guest_outcome,
        host_score = EXCLUDED.host_score,
        guest_score = EXCLUDED.guest_score,
        host_solved_at = EXCLUDED.host_solved_at,
        guest_solved_at = EXCLUDED.guest_solved_at,
        host_extensions_used = EXCLUDED.host_extensions_used,
        guest_extensions_used = EXCLUDED.guest_extensions_used,
        resolved_at = EXCLUDED.resolved_at`,
      [
        round.id, round.matchId, round.roundIndex, round.word, round.startedAt,
        round.nextStartAt, round.baseDeadlineAt, round.hostDeadlineAt,
        round.guestDeadlineAt, round.hostOutcome, round.guestOutcome,
        round.hostScore, round.guestScore, round.hostSolvedAt,
        round.guestSolvedAt, round.hostExtensionsUsed,
        round.guestExtensionsUsed, round.resolvedAt,
      ],
    );
  }

  async insertSubmission(submission: LingoMpDbSubmission): Promise<void> {
    await this.q(
      `INSERT INTO lingo_round_submissions (id, match_id, round_id, player,
        seq, word, result_json, created_at)
       VALUES ($1, (SELECT match_id FROM lingo_match_rounds WHERE id = $2),
        $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        submission.id, submission.roundId, submission.player, submission.seq,
        submission.word, submission.resultJson, submission.createdAt,
      ],
    );
  }

  async insertEvent(event: LingoMpDbEvent): Promise<void> {
    await this.q(
      `INSERT INTO lingo_match_events (id, match_id, action_id, type, player,
        payload_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        event.id, event.matchId, event.actionId, event.type, event.player,
        event.payloadJson, event.createdAt,
      ],
    );
  }

  async insertResult(result: LingoMpDbResult): Promise<void> {
    await this.q(
      `INSERT INTO lingo_match_results (match_id, result_json, created_at)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [result.matchId, result.resultJson, result.createdAt],
    );
  }

  async transaction<T>(fn: (tx: LingoMpStore) => Promise<T>): Promise<T> {
    // Already inside a transaction; nested calls share this handle.
    return fn(this);
  }

  async rateLimit(
    bucket: string,
    max: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const windowMs = windowSec * 1000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const { rows } = await this.q(
      `INSERT INTO lingo_rate_limits (bucket, window_start, hits)
       VALUES ($1, $2, 1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET
         hits = lingo_rate_limits.hits + 1
       RETURNING hits`,
      [bucket, windowStart],
    );
    const hits = Number(rows[0]?.hits ?? 0);
    return { allowed: hits <= max, retryAfterSec: windowSec };
  }

  async ping(): Promise<boolean> {
    try {
      await this.q("SELECT 1", []);
      return true;
    } catch {
      return false;
    }
  }

  async schemaVersion(): Promise<number> {
    const { rows } = await this.q(
      "SELECT MAX(version) AS v FROM lingo_schema_versions",
    );
    return Number(rows[0]?.v ?? 0);
  }

  async migrate(): Promise<void> {
    // Migrations run on the owning pool before the transaction starts.
  }
}
