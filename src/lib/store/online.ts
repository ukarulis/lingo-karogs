import type { Side } from "@/lib/karogs/engine";
import { storageGet, storageSet } from "./storage";

export interface OnlineSession {
  gameId: string;
  code: string;
  playerToken: string;
  side: Side;
  nickname: string;
}

export function saveOnlineSession(session: OnlineSession): void {
  const all = loadOnlineSessions();
  all[session.gameId] = session;
  storageSet("onlineSessions", all);
}

export function loadOnlineSessions(): Record<string, OnlineSession> {
  return storageGet<Record<string, OnlineSession>>("onlineSessions") ?? {};
}

export function getOnlineSession(gameId: string): OnlineSession | null {
  return loadOnlineSessions()[gameId] ?? null;
}

export function getPlayerToken(gameId: string): string | null {
  return getOnlineSession(gameId)?.playerToken ?? null;
}
