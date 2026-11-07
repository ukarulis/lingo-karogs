// Browser-side Lingo multiplayer API client. Relative fetches only.

import { guestId, storageGet, storageSet } from "@/lib/store/storage";
import type {
  CreateMatchRequest,
  CreateMatchResponse,
  JoinMatchResponse,
  LingoMpAction,
  LingoMpActionResponse,
  LingoMpFormat,
  LingoMpView,
} from "./types";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface LingoMpSession {
  matchId: string;
  code: string;
  playerToken: string;
  slot: "host" | "guest";
  nickname: string;
}

export function saveLingoMpSession(session: LingoMpSession): void {
  storageSet(`lingoMp:${session.matchId}`, session);
  storageSet("lingoMp:last", { matchId: session.matchId, code: session.code });
}

export function getLingoMpSession(matchId: string): LingoMpSession | null {
  return storageGet<LingoMpSession>(`lingoMp:${matchId}`);
}

export function lastLingoMpSession(): {
  matchId: string;
  code: string;
} | null {
  return storageGet<{ matchId: string; code: string }>("lingoMp:last");
}

async function guestHashForPlayer(): Promise<string> {
  const id = guestId();
  return sha256Hex(`lk-guest:${id}`);
}

export async function apiCreateLingoMatch(
  format: LingoMpFormat,
  length: number,
  nickname: string,
): Promise<CreateMatchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const body: CreateMatchRequest = {
    format,
    length,
    nickname,
    guestHash: await guestHashForPlayer(),
    playerToken: crypto.randomUUID(),
  };
  const res = await fetch("/api/lingo-mp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const json = (await res.json()) as CreateMatchResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās izveidot istabu");
  return json;
}

export async function apiLingoMpStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/lingo-mp/status", { cache: "no-store" });
    if (!res.ok) return false;
    const json = (await res.json()) as { available: boolean };
    return json.available;
  } catch {
    return false;
  }
}

export async function apiJoinLingoMatch(
  code: string,
  nickname: string,
): Promise<JoinMatchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const body = {
    code,
    nickname,
    guestHash: await guestHashForPlayer(),
    playerToken: crypto.randomUUID(),
  };
  const res = await fetch("/api/lingo-mp/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const json = (await res.json()) as JoinMatchResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās pievienoties");
  return json;
}

/** Rejoin (e.g. a rematch room) with an existing player token. */
export async function apiJoinLingoMatchWithToken(
  code: string,
  nickname: string,
  playerToken: string,
): Promise<JoinMatchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const res = await fetch("/api/lingo-mp/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      nickname,
      guestHash: await guestHashForPlayer(),
      playerToken,
    }),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const json = (await res.json()) as JoinMatchResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Neizdevās pievienoties");
  return json;
}

export async function apiLingoMpView(
  matchId: string,
  playerToken: string,
): Promise<LingoMpView> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(`/api/lingo-mp/${matchId}`, {
    cache: "no-store",
    headers: { "x-player-token": playerToken },
    signal: controller.signal,
  });
  clearTimeout(timer);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Neizdevās ielādēt spēli");
  }
  return (await res.json()) as LingoMpView;
}

export async function apiLingoMpAction(
  matchId: string,
  playerToken: string,
  action: LingoMpAction,
): Promise<LingoMpActionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(`/api/lingo-mp/${matchId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: playerToken, action }),
    signal: controller.signal,
  });
  clearTimeout(timer);
  return (await res.json()) as LingoMpActionResponse;
}
