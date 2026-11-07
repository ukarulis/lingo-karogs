// Production Lingo multiplayer store backed by Supabase PostgreSQL.
// Server-side only; requires the service-role key and the schema from
// supabase/migrations-lingo.sql. Not usable without provisioned credentials.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  LingoMpDbEvent,
  LingoMpDbMatch,
  LingoMpDbResult,
  LingoMpDbRound,
  LingoMpDbSubmission,
  LingoMpStore,
} from "./store";

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

export class SupabaseLingoMpStore implements LingoMpStore {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase Lingo store requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async createMatch(match: LingoMpDbMatch): Promise<LingoMpDbMatch> {
    const { data, error } = await this.client
      .from("lingo_matches")
      .insert({
        id: match.id,
        code: match.code,
        format: match.format,
        status: match.status,
        config_json: match.configJson,
        targets_json: match.targetsJson,
        host_token_hash: match.hostTokenHash,
        guest_token_hash: match.guestTokenHash,
        host_nickname: match.hostNickname,
        guest_nickname: match.guestNickname,
        host_guest_hash: match.hostGuestHash,
        guest_guest_hash: match.guestGuestHash,
        host_ready: match.hostReady,
        guest_ready: match.guestReady,
        countdown_ends_at: match.countdownEndsAt,
        match_started_at: match.matchStartedAt,
        current_round_index: match.currentRoundIndex,
        round_started_at: match.roundStartedAt,
        next_round_started_at: match.nextRoundStartedAt,
        host_deadline_at: match.hostDeadlineAt,
        guest_deadline_at: match.guestDeadlineAt,
        host_extensions_left: match.hostExtensionsLeft,
        guest_extensions_left: match.guestExtensionsLeft,
        host_extensions_used_round: match.hostExtensionsUsedRound,
        guest_extensions_used_round: match.guestExtensionsUsedRound,
        winner: match.winner,
        end_reason: match.endReason,
        result_json: match.resultJson,
        rematch_requested_host: match.rematchRequestedHost,
        rematch_requested_guest: match.rematchRequestedGuest,
        rematch_of: match.rematchOf,
        rematch_with_code: match.rematchWithCode,
        version: match.version,
        last_action_ids: match.lastActionIds,
        last_action_at: match.lastActionAt,
        created_at: match.createdAt,
        updated_at: match.updatedAt,
        expires_at: match.expiresAt,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("createMatch failed");
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
    return rowToMatch(data as Record<string, unknown>);
  }

  async getMatch(id: string): Promise<LingoMpDbMatch | null> {
    const { data, error } = await this.client
      .from("lingo_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMatch(data as Record<string, unknown>) : null;
  }

  async getMatchByCode(code: string): Promise<LingoMpDbMatch | null> {
    const { data, error } = await this.client
      .from("lingo_matches")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMatch(data as Record<string, unknown>) : null;
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
    const mapped: Record<string, unknown> = {};
    for (const [key, column] of map) {
      if (patch[key] !== undefined) mapped[column] = patch[key];
    }
    const { data, error } = await this.client
      .from("lingo_matches")
      .update(mapped)
      .eq("id", id)
      .eq("version", version)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMatch(data as Record<string, unknown>) : null;
  }

  async getRounds(matchId: string): Promise<LingoMpDbRound[]> {
    const { data, error } = await this.client
      .from("lingo_match_rounds")
      .select("*")
      .eq("match_id", matchId)
      .order("round_index");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
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
    const { data, error } = await this.client
      .from("lingo_round_submissions")
      .select("*")
      .eq("match_id", matchId)
      .order("seq");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
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
    const { data, error } = await this.client
      .from("lingo_match_events")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
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
    const { error } = await this.client.from("lingo_match_rounds").upsert({
      id: round.id,
      match_id: round.matchId,
      round_index: round.roundIndex,
      word: round.word,
      started_at: round.startedAt,
      next_start_at: round.nextStartAt,
      base_deadline_at: round.baseDeadlineAt,
      host_deadline_at: round.hostDeadlineAt,
      guest_deadline_at: round.guestDeadlineAt,
      host_outcome: round.hostOutcome,
      guest_outcome: round.guestOutcome,
      host_score: round.hostScore,
      guest_score: round.guestScore,
      host_solved_at: round.hostSolvedAt,
      guest_solved_at: round.guestSolvedAt,
      host_extensions_used: round.hostExtensionsUsed,
      guest_extensions_used: round.guestExtensionsUsed,
      resolved_at: round.resolvedAt,
    });
    if (error) throw error;
  }

  async insertSubmission(submission: LingoMpDbSubmission): Promise<void> {
    const { error } = await this.client.from("lingo_round_submissions").upsert(
      {
        id: submission.id,
        match_id: submission.roundId,
        round_id: submission.roundId,
        player: submission.player,
        seq: submission.seq,
        word: submission.word,
        result_json: submission.resultJson,
        created_at: submission.createdAt,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  async insertEvent(event: LingoMpDbEvent): Promise<void> {
    const { error } = await this.client.from("lingo_match_events").upsert(
      {
        id: event.id,
        match_id: event.matchId,
        action_id: event.actionId,
        type: event.type,
        player: event.player,
        payload_json: event.payloadJson,
        created_at: event.createdAt,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  async insertResult(result: LingoMpDbResult): Promise<void> {
    const { error } = await this.client.from("lingo_match_results").upsert(
      {
        match_id: result.matchId,
        result_json: result.resultJson,
        created_at: result.createdAt,
      },
      { onConflict: "match_id" },
    );
    if (error) throw error;
  }
}
