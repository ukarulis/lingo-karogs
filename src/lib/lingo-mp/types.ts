// Lingo multiplayer domain: protocol types shared between the server service
// and the browser client. Server-private fields (targets, full guess
// histories) live in the store models, never in these views.

export type LingoMpFormat = "quick-duel" | "five-word-battle";

export type LingoMpMatchStatus =
  | "waiting"
  | "ready"
  | "countdown"
  | "playing"
  | "finished"
  | "cancelled"
  | "expired"
  | "forfeited";

export type LingoMpSlot = "host" | "guest";

export type PlayerRoundOutcome = "playing" | "solved" | "failed" | "timeout";

/** Frozen when the match is created; never derived from client input later. */
export interface LingoMpConfig {
  format: LingoMpFormat;
  language: string;
  dictionaryVersion: string;
  ruleSetVersion: string;
  length: number;
  maxAttempts: number;
  guessPolicy: "freeform";
  revealFirstLetter: boolean;
  carryConfirmedLetters: boolean;
  words: number;
  timePerWordSec: number;
  extensionsPerMatch: number;
  extensionSeconds: number;
  maxExtensionsPerRound: number;
}

export interface LingoMpPresets {
  "quick-duel": {
    words: number;
    timePerWordSec: number;
    extensionsPerMatch: number;
  };
  "five-word-battle": {
    words: number;
    timePerWordSec: number;
    extensionsPerMatch: number;
  };
}

export const LINGO_MP_PRESETS: LingoMpPresets = {
  "quick-duel": { words: 1, timePerWordSec: 60, extensionsPerMatch: 0 },
  "five-word-battle": {
    words: 5,
    timePerWordSec: 90,
    extensionsPerMatch: 3,
  },
};

export type LingoMpActionType =
  | "ready"
  | "guess"
  | "extend"
  | "forfeit"
  | "cancel"
  | "rematch"
  | "leave";

export interface LingoMpAction {
  actionId: string;
  type: LingoMpActionType;
  payload?: {
    word?: string;
  };
}

export interface EvaluatedGuess {
  seq: number;
  word: string;
  result: ("correct" | "present" | "absent")[];
  acceptedAt: string;
}

export interface RoundPlayerView {
  slot: LingoMpSlot;
  nickname: string | null;
  outcome: PlayerRoundOutcome;
  attemptsUsed: number;
  score: number;
  solvedAt: string | null;
}

export interface RoundView {
  /** Stable authoritative round identity (matchId:roundIndex). */
  id: string;
  index: number;
  status: "pending" | "active" | "resolved";
  wordLength: number;
  firstLetter: string | null;
  startedAt: string | null;
  nextStartAt: string | null;
  /** The requesting player's effective deadline. */
  yourDeadline: string | null;
  /** The requesting player's evaluated guesses. */
  yourGuesses: EvaluatedGuess[];
  yourAttemptsLeft: number;
  yourOutcome: PlayerRoundOutcome;
  yourExtensionsUsedThisRound: number;
  /** The revealed word; present only once the round is resolved. */
  word: string | null;
  players: RoundPlayerView[];
}

export interface MatchResultRow {
  index: number;
  word: string;
  host: { outcome: PlayerRoundOutcome; attemptsUsed: number; score: number; elapsedSec: number };
  guest: { outcome: PlayerRoundOutcome; attemptsUsed: number; score: number; elapsedSec: number };
}

export interface MatchResult {
  winner: LingoMpSlot | "draw";
  endReason: string;
  host: { score: number; solved: number; guesses: number; elapsedSec: number };
  guest: { score: number; solved: number; guesses: number; elapsedSec: number };
  rounds: MatchResultRow[];
}

export interface LingoMpView {
  matchId: string;
  code: string;
  status: LingoMpMatchStatus;
  format: LingoMpFormat;
  language: string;
  length: number;
  maxAttempts: number;
  words: number;
  timePerWordSec: number;
  extensionsPerMatch: number;
  extensionSeconds: number;
  version: number;
  serverNow: string;
  you: { slot: LingoMpSlot; nickname: string | null };
  players: Array<{
    slot: LingoMpSlot;
    nickname: string | null;
    ready: boolean;
    connected: boolean;
    totalScore: number;
    wordsSolved: number;
    extensionsLeft: number;
  }>;
  countdownEndsAt: string | null;
  currentRound: RoundView | null;
  /** Resolved rounds with revealed words and scores (public after resolution). */
  resolvedRounds: RoundView[];
  roundIndex: number;
  totalRounds: number;
  result: MatchResult | null;
  rematch: {
    requestedByMe: boolean;
    requestedByOpponent: boolean;
    newCode: string | null;
  };
}

export interface CreateMatchRequest {
  format: LingoMpFormat;
  length: number;
  nickname: string;
  guestHash: string;
  playerToken: string;
}

export interface CreateMatchResponse {
  matchId: string;
  code: string;
  playerToken: string;
  inviteUrl: string;
}

export interface JoinMatchResponse {
  matchId: string;
  code: string;
  playerToken: string;
  slot: LingoMpSlot;
}

export interface LingoMpActionResponse {
  ok: boolean;
  code?: string;
  error?: string;
  view?: LingoMpView;
}

export const LINGO_ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINGO_ROOM_CODE_LENGTH = 6;
export const LINGO_MP_COUNTDOWN_MS = 4000;
export const LINGO_MP_TRANSITION_MS = 5000;
export const LINGO_MP_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
