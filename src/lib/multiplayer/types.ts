import type { Cell, MoveRecord, Piece, Side } from "@/lib/karogs/engine";

export type GameStatus = "waiting" | "setup" | "playing" | "finished" | "abandoned";

export interface DbGame {
  id: string;
  code: string;
  status: GameStatus;
  hostTokenHash: string;
  guestTokenHash: string | null;
  redTokenHash: string | null;
  blueTokenHash: string | null;
  redNickname: string | null;
  blueNickname: string | null;
  hostGuestHash: string;
  guestGuestHash: string | null;
  stateJson: string;
  version: number;
  readyRed: boolean;
  readyBlue: boolean;
  lastActionIds: string[];
  lastActionAt: string;
  winner: Side | "draw" | null;
  endReason: string | null;
  rematchOf: string | null;
  rematchWithCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StateView {
  gameId: string;
  code: string;
  status: GameStatus;
  yourSide: Side | null;
  yourNickname: string | null;
  players: {
    red: { nickname: string | null; ready: boolean; connected: boolean } | null;
    blue: { nickname: string | null; ready: boolean; connected: boolean } | null;
  };
  phase: "setup" | "playing" | "finished";
  turn: Side | null;
  board: Cell[] | null;
  moves: MoveRecord[];
  captured: Record<Side, number>;
  winner: Side | "draw" | null;
  endReason: string | null;
  yourSetup: Record<number, Piece> | null;
  ready: boolean;
  lastActionAt: string;
  claimable: boolean;
  rematchCode: string | null;
  version: number;
}

export type PlayerActionType =
  | "deploy"
  | "ready"
  | "move"
  | "resign"
  | "rematch"
  | "cancel"
  | "claim-abandon";

export interface PlayerAction {
  actionId: string;
  type: PlayerActionType;
  payload: {
    placement?: Record<number, Piece>;
    pieceId?: string;
    to?: number;
  };
}

export interface CreateRoomResponse {
  gameId: string;
  code: string;
  playerToken: string;
  inviteUrl: string;
}

export interface JoinRoomResponse {
  gameId: string;
  code: string;
  playerToken: string;
  side: Side;
}

export interface ActionResponse {
  ok: boolean;
  code?: string;
  error?: string;
  view?: StateView;
}

export interface LeaderboardRow {
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  points: number;
}

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ABANDON_MS = 15 * 60 * 1000;

export function validateNickname(raw: unknown): string {
  const nick = typeof raw === "string" ? raw.trim() : "";
  if (!/^[\p{L}\p{N} .\-_]{2,20}$/u.test(nick)) {
    throw new Error(
      "Segvārdam jābūt 2–20 zīmēm (burti, cipari, atstarpes, . - _)",
    );
  }
  return nick;
}
