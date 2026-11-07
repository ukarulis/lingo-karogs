// Server-private Lingo multiplayer persistence models and store interface.
// These models are never serialized directly into API responses.

import type {
  LingoMpMatchStatus,
  PlayerRoundOutcome,
} from "./types";

export interface LingoMpDbMatch {
  id: string;
  code: string;
  format: "quick-duel" | "five-word-battle";
  status: LingoMpMatchStatus;
  configJson: string;
  targetsJson: string;
  hostTokenHash: string;
  guestTokenHash: string | null;
  hostNickname: string | null;
  guestNickname: string | null;
  hostGuestHash: string;
  guestGuestHash: string | null;
  hostReady: boolean;
  guestReady: boolean;
  countdownEndsAt: string | null;
  matchStartedAt: string | null;
  currentRoundIndex: number;
  roundStartedAt: string | null;
  nextRoundStartedAt: string | null;
  hostDeadlineAt: string | null;
  guestDeadlineAt: string | null;
  hostExtensionsLeft: number;
  guestExtensionsLeft: number;
  hostExtensionsUsedRound: number;
  guestExtensionsUsedRound: number;
  winner: "host" | "guest" | "draw" | null;
  endReason: string | null;
  resultJson: string | null;
  rematchRequestedHost: boolean;
  rematchRequestedGuest: boolean;
  rematchOf: string | null;
  rematchWithCode: string | null;
  version: number;
  lastActionIds: string[];
  lastActionAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface LingoMpDbRound {
  id: string;
  matchId: string;
  roundIndex: number;
  word: string;
  startedAt: string | null;
  nextStartAt: string | null;
  baseDeadlineAt: string | null;
  hostDeadlineAt: string | null;
  guestDeadlineAt: string | null;
  hostOutcome: PlayerRoundOutcome;
  guestOutcome: PlayerRoundOutcome;
  hostScore: number;
  guestScore: number;
  hostSolvedAt: string | null;
  guestSolvedAt: string | null;
  hostExtensionsUsed: number;
  guestExtensionsUsed: number;
  resolvedAt: string | null;
}

export interface LingoMpDbSubmission {
  id: string;
  roundId: string;
  player: "host" | "guest";
  seq: number;
  word: string;
  resultJson: string;
  createdAt: string;
}

export interface LingoMpDbEvent {
  id: string;
  matchId: string;
  actionId: string;
  type: string;
  player: "host" | "guest" | "system";
  payloadJson: string;
  createdAt: string;
}

export interface LingoMpDbResult {
  matchId: string;
  resultJson: string;
  createdAt: string;
}

export interface LingoMpStore {
  createMatch(match: LingoMpDbMatch): Promise<LingoMpDbMatch>;
  getMatch(id: string): Promise<LingoMpDbMatch | null>;
  getMatchByCode(code: string): Promise<LingoMpDbMatch | null>;
  /** Atomic optimistic update; returns null when the version no longer matches. */
  updateIfVersion(
    id: string,
    version: number,
    patch: Partial<LingoMpDbMatch>,
  ): Promise<LingoMpDbMatch | null>;
  getRounds(matchId: string): Promise<LingoMpDbRound[]>;
  getSubmissions(matchId: string): Promise<LingoMpDbSubmission[]>;
  getEvents(matchId: string): Promise<LingoMpDbEvent[]>;
  /** Idempotent round upsert (INSERT OR IGNORE / ON CONFLICT DO UPDATE). */
  upsertRound(round: LingoMpDbRound): Promise<void>;
  insertSubmission(submission: LingoMpDbSubmission): Promise<void>;
  insertEvent(event: LingoMpDbEvent): Promise<void>;
  insertResult(result: LingoMpDbResult): Promise<void>;
  /**
   * Run a set of related reads/writes atomically. Implementations must give
   * the callback a store handle whose writes share the same transaction.
   */
  transaction<T>(fn: (tx: LingoMpStore) => Promise<T>): Promise<T>;
  /** Durable rate limit (shared across instances where the backend allows). */
  rateLimit(
    bucket: string,
    max: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }>;
  /** Cheap connectivity probe. */
  ping(): Promise<boolean>;
  /** Applied schema version. */
  schemaVersion(): Promise<number>;
  /** Apply pending migrations (idempotent). */
  migrate(): Promise<void>;
  close?(): void;
}

export interface MatchAggregate {
  match: LingoMpDbMatch;
  rounds: LingoMpDbRound[];
  submissions: LingoMpDbSubmission[];
  events: LingoMpDbEvent[];
}
