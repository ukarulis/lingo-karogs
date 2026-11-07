// Production multiplayer store backed by Supabase PostgreSQL.
// Only server-side code imports this module; it uses the service-role key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DbGame, GameStatus, LeaderboardRow } from "./types";
import type { GameResultRow, MpStore } from "./store";

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

export class SupabaseMpStore implements MpStore {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase store requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async createGame(game: DbGame): Promise<DbGame> {
    const { data, error } = await this.client
      .from("multiplayer_games")
      .insert({
        id: game.id,
        code: game.code,
        status: game.status,
        host_token_hash: game.hostTokenHash,
        guest_token_hash: game.guestTokenHash,
        red_token_hash: game.redTokenHash,
        blue_token_hash: game.blueTokenHash,
        red_nickname: game.redNickname,
        blue_nickname: game.blueNickname,
        host_guest_hash: game.hostGuestHash,
        guest_guest_hash: game.guestGuestHash,
        state_json: game.stateJson,
        version: game.version,
        ready_red: game.readyRed,
        ready_blue: game.readyBlue,
        last_action_ids: game.lastActionIds,
        last_action_at: game.lastActionAt,
        winner: game.winner,
        end_reason: game.endReason,
        rematch_of: game.rematchOf,
        rematch_with_code: game.rematchWithCode,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("createGame failed");
    return rowToGame(data as Record<string, unknown>);
  }

  async getGame(id: string): Promise<DbGame | null> {
    const { data, error } = await this.client
      .from("multiplayer_games")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToGame(data as Record<string, unknown>) : null;
  }

  async getGameByCode(code: string): Promise<DbGame | null> {
    const { data, error } = await this.client
      .from("multiplayer_games")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data ? rowToGame(data as Record<string, unknown>) : null;
  }

  async updateIfVersion(
    id: string,
    version: number,
    patch: Partial<DbGame>,
  ): Promise<DbGame | null> {
    const mapped: Record<string, unknown> = {};
    const map: Array<[keyof DbGame, string]> = [
      ["version", "version"],
      ["status", "status"],
      ["guestTokenHash", "guest_token_hash"],
      ["redTokenHash", "red_token_hash"],
      ["blueTokenHash", "blue_token_hash"],
      ["redNickname", "red_nickname"],
      ["blueNickname", "blue_nickname"],
      ["guestGuestHash", "guest_guest_hash"],
      ["stateJson", "state_json"],
      ["readyRed", "ready_red"],
      ["readyBlue", "ready_blue"],
      ["lastActionIds", "last_action_ids"],
      ["lastActionAt", "last_action_at"],
      ["winner", "winner"],
      ["endReason", "end_reason"],
      ["rematchOf", "rematch_of"],
      ["rematchWithCode", "rematch_with_code"],
      ["updatedAt", "updated_at"],
    ];
    for (const [key, column] of map) {
      if (patch[key] !== undefined) mapped[column] = patch[key];
    }
    const { data, error } = await this.client
      .from("multiplayer_games")
      .update(mapped)
      .eq("id", id)
      .eq("version", version)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? rowToGame(data as Record<string, unknown>) : null;
  }

  async insertResult(result: GameResultRow): Promise<void> {
    const { error } = await this.client.from("multiplayer_results").insert({
      game_id: result.gameId,
      winner_side: result.winnerSide,
      winner_guest_hash: result.winnerGuestHash,
      red_guest_hash: result.redGuestHash,
      blue_guest_hash: result.blueGuestHash,
      red_nickname: result.redNickname,
      blue_nickname: result.blueNickname,
      moves: result.moves,
      duration_sec: result.durationSec,
      end_reason: result.endReason,
    });
    if (error) throw error;
  }

  async leaderboard(limit: number): Promise<LeaderboardRow[]> {
    const { data, error } = await this.client.rpc("multiplayer_leaderboard", {
      row_limit: limit,
    });
    if (error || !data) throw error ?? new Error("leaderboard failed");
    return (data as Array<{
      nickname: string;
      wins: number;
      losses: number;
      draws: number;
      games: number;
    }>).map((r) => ({
      nickname: r.nickname,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      games: r.games,
      points: r.wins * 3 + r.draws,
    }));
  }
}
