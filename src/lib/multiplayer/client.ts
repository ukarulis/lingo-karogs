// Browser-side multiplayer API client. Relative fetches only.

import type {
  ActionResponse,
  CreateRoomResponse,
  JoinRoomResponse,
  LeaderboardRow,
  PlayerAction,
  StateView,
} from "./types";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function apiCreateRoom(nickname: string): Promise<CreateRoomResponse> {
  const guestHash = await sha256Hex(`lk-guest:${localStorage.getItem("lk.guestId")}`);
  const playerToken = crypto.randomUUID();
  const res = await fetch("/api/multiplayer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname, guestHash, playerToken }),
  });
  const json = (await res.json()) as CreateRoomResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās izveidot istabu");
  return json;
}

export async function apiJoinRoom(
  code: string,
  nickname: string,
): Promise<JoinRoomResponse> {
  const guestHash = await sha256Hex(`lk-guest:${localStorage.getItem("lk.guestId")}`);
  const playerToken = crypto.randomUUID();
  const res = await fetch("/api/multiplayer/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, nickname, guestHash, playerToken }),
  });
  const json = (await res.json()) as JoinRoomResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās pievienoties");
  return json;
}

/** Rejoin (e.g. a rematch) with an existing player token. */
export async function apiJoinWithToken(
  code: string,
  nickname: string,
  playerToken: string,
): Promise<JoinRoomResponse> {
  const guestHash = await sha256Hex(`lk-guest:${localStorage.getItem("lk.guestId")}`);
  const res = await fetch("/api/multiplayer/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, nickname, guestHash, playerToken }),
  });
  const json = (await res.json()) as JoinRoomResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās pievienoties");
  return json;
}

export async function apiView(
  gameId: string,
  playerToken: string,
): Promise<StateView> {
  const res = await fetch(`/api/multiplayer/${gameId}?token=${encodeURIComponent(playerToken)}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Neizdevās ielādēt spēli");
  }
  return (await res.json()) as StateView;
}

export async function apiAction(
  gameId: string,
  playerToken: string,
  action: PlayerAction,
): Promise<ActionResponse> {
  const res = await fetch(`/api/multiplayer/${gameId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: playerToken, action }),
  });
  return (await res.json()) as ActionResponse;
}

export async function apiLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { rows: LeaderboardRow[] };
  return json.rows;
}
