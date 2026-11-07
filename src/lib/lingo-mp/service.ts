// Server-side Lingo multiplayer orchestration: room lifecycle, authorization,
// idempotent actions and authoritative persistence. Runs only on the server.
// All related writes happen inside a store transaction.

import crypto from "node:crypto";
import { loadPool } from "@/lib/lingo/pools";
import { getPack } from "@/lib/lingo/pack/registry";
import type { LingoMpStore, MatchAggregate } from "./store";
import {
  type LingoMpDbMatch,
  type LingoMpDbResult,
  type LingoMpDbRound,
} from "./store";
import {
  type CreateMatchRequest,
  type CreateMatchResponse,
  type JoinMatchResponse,
  type LingoMpAction,
  type LingoMpActionResponse,
  type LingoMpFormat,
  type LingoMpView,
  LINGO_ROOM_CODE_ALPHABET,
  LINGO_ROOM_CODE_LENGTH,
} from "./types";
import {
  LingoMpError,
  applyAction,
  authorizeSlot,
  buildConfig,
  buildView,
  configOf,
  freshMatch,
  reconcile,
  validateConfigForServer,
} from "./engine";
import { mpError, mpLog } from "./log";

export { LingoMpError } from "./engine";

/** Internal: an optimistic update lost a version race; retry outside. */
class TransactionConflict extends Error {}

/**
 * Hash a player token with a server secret. Production fails closed when the
 * secret is missing or too short instead of silently using a fallback.
 */
export function hashLingoToken(token: string): string {
  const salt = process.env.PLAYER_TOKEN_SALT;
  if (process.env.NODE_ENV === "production") {
    if (!salt || salt.length < 16) {
      throw new LingoMpError(
        503,
        "not-configured",
        "Tiešsaistes spēle nav konfigurēta (PLAYER_TOKEN_SALT)",
      );
    }
  }
  const effective = salt && salt.length >= 16 ? salt : "lingo-karogs-dev-salt";
  return crypto
    .createHash("sha256")
    .update(`${effective}:${token}`)
    .digest("hex");
}

function randomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < LINGO_ROOM_CODE_LENGTH; i++) {
    chars.push(
      LINGO_ROOM_CODE_ALPHABET[
        crypto.randomInt(0, LINGO_ROOM_CODE_ALPHABET.length)
      ],
    );
  }
  return chars.join("");
}

export function validateLingoNickname(raw: unknown): string {
  const nick = typeof raw === "string" ? raw.trim() : "";
  if (!/^[\p{L}\p{N} .\-_]{2,20}$/u.test(nick)) {
    throw new LingoMpError(
      400,
      "bad-nickname",
      "Segvārdam jābūt 2–20 zīmēm (burti, cipari, atstarpes, . - _)",
    );
  }
  return nick;
}

export class LingoMultiplayerService {
  constructor(private store: LingoMpStore) {}

  async createMatch(params: CreateMatchRequest): Promise<CreateMatchResponse> {
    const config = buildConfig(params.format as LingoMpFormat, params.length);
    validateConfigForServer(config);
    const pack = getPack(config.language);
    const pool = await loadPool(config.length);
    if (!pack || !pool) {
      throw new LingoMpError(
        503,
        "language-unavailable",
        "Šis garums pašlaik nav pieejams",
      );
    }
    const nickname = validateLingoNickname(params.nickname);
    const id = crypto.randomUUID();
    const code = await this.uniqueCode();
    const targets = this.pickTargets(pool.targets, config.words, new Set());
    const agg = freshMatch(
      id,
      code,
      config,
      targets,
      {
        tokenHash: hashLingoToken(params.playerToken),
        nickname,
        guestHash: params.guestHash,
      },
      Date.now(),
    );
    await this.store.transaction(async (tx) => {
      await tx.createMatch(agg.match);
      for (const round of agg.rounds) await tx.upsertRound(round);
    });
    mpLog("match-created", { matchId: id, code, format: config.format });
    return {
      matchId: id,
      code,
      playerToken: params.playerToken,
      inviteUrl: `/lingo?room=${code}`,
    };
  }

  async joinMatch(params: {
    code: string;
    nickname: string;
    guestHash: string;
    playerToken: string;
  }): Promise<JoinMatchResponse> {
    const nickname = validateLingoNickname(params.nickname);
    const tokenHash = hashLingoToken(params.playerToken);
    for (let attempt = 0; attempt < 3; attempt++) {
      const joined = await this.store.transaction(async (tx) => {
        const match = await tx.getMatchByCode(params.code);
        if (!match) return null;
        const known =
          match.hostTokenHash === tokenHash
            ? "host"
            : match.guestTokenHash === tokenHash
              ? "guest"
              : null;
        if (known) {
          return { match, slot: known as "host" | "guest" };
        }
        if (match.status !== "waiting" || match.guestTokenHash) {
          throw new LingoMpError(409, "room-full", "Istaba ir pilna");
        }
        const now = Date.now();
        const updated = await tx.updateIfVersion(match.id, match.version, {
          version: match.version + 1,
          guestTokenHash: tokenHash,
          guestNickname: nickname,
          guestGuestHash: params.guestHash,
          status: "ready",
          lastActionAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        });
        return updated
          ? { match: updated, slot: "guest" as const }
          : { conflict: true as const };
      });
      if (!joined) {
        throw new LingoMpError(404, "room-not-found", "Istaba nav atrasta");
      }
      if ("conflict" in joined) continue;
      mpLog("match-joined", {
        matchId: joined.match.id,
        code: joined.match.code,
        slot: joined.slot,
      });
      return {
        matchId: joined.match.id,
        code: joined.match.code,
        playerToken: params.playerToken,
        slot: joined.slot,
      };
    }
    throw new LingoMpError(409, "conflict", "Mēģini vēlreiz");
  }

  async getView(matchId: string, playerToken: string): Promise<LingoMpView> {
    const tokenHash = hashLingoToken(playerToken);
    for (let attempt = 0; attempt < 3; attempt++) {
      const view = await this.store.transaction(async (tx) => {
        const agg = await this.loadAggregateFrom(tx, matchId);
        if (!agg) {
          throw new LingoMpError(404, "room-not-found", "Istaba nav atrasta");
        }
        const slot = authorizeSlot(agg.match, tokenHash);
        const now = Date.now();
        const next = await this.persistReconciledVia(tx, agg, now);
        return buildView(next, slot, now);
      });
      return view;
    }
    throw new LingoMpError(409, "conflict", "Mēģini vēlreiz");
  }

  async action(
    matchId: string,
    playerToken: string,
    action: LingoMpAction,
  ): Promise<LingoMpActionResponse> {
    const tokenHash = hashLingoToken(playerToken);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const outcome = await this.store.transaction(async (tx) => {
          const agg = await this.loadAggregateFrom(tx, matchId);
          if (!agg) {
            return { kind: "missing" as const };
          }
          const slot = authorizeSlot(agg.match, tokenHash);
          const now = Date.now();
          // Idempotency: a repeated action returns the current state.
          if (agg.match.lastActionIds.includes(action.actionId)) {
            const next = await this.persistReconciledVia(tx, agg, now);
            return {
              kind: "view" as const,
              view: buildView(next, slot, now),
            };
          }
          let next = reconcile(agg, now);
          const applied = applyAction(next, slot, action, now);
          next = reconcile(applied, now);
          if (
            action.type === "rematch" &&
            next.match.status === "finished" &&
            next.match.rematchRequestedHost &&
            next.match.rematchRequestedGuest &&
            !next.match.rematchWithCode
          ) {
            next = await this.createRematchVia(tx, next, now);
          }
          const saved = await this.saveAggregateVia(tx, agg, next);
          if (!saved) throw new TransactionConflict();
          await this.maybeRecordResultVia(tx, saved);
          const final = await this.persistReconciledVia(tx, saved, now);
          return {
            kind: "done" as const,
            view: buildView(final, slot, now),
          };
        });
        if (outcome.kind === "missing") {
          return { ok: false, code: "room-not-found", error: "Istaba nav atrasta" };
        }
        if (outcome.kind === "done") {
          mpLog("action-applied", {
            matchId,
            actionType: action.type,
            actionId: action.actionId.slice(0, 8),
          });
        }
        return { ok: true, view: outcome.view };
      } catch (error) {
        if (error instanceof TransactionConflict) continue;
        if (error instanceof LingoMpError) throw error;
        mpError("action-failed", error, { matchId, actionType: action.type });
        return { ok: false, code: "internal", error: "Darbība neizdevās" };
      }
    }
    return {
      ok: false,
      code: "conflict",
      error: "Vienlaicīgs pieprasījums — mēģini vēlreiz",
    };
  }

  private async createRematchVia(
    tx: LingoMpStore,
    agg: MatchAggregate,
    nowMs: number,
  ): Promise<MatchAggregate> {
    const old = agg.match;
    const config = configOf(old);
    const pool = await loadPool(config.length);
    if (!pool) {
      throw new LingoMpError(
        503,
        "language-unavailable",
        "Revanšs pašlaik nav pieejams",
      );
    }
    const previous = new Set<string>(JSON.parse(old.targetsJson) as string[]);
    const targets = this.pickTargets(pool.targets, config.words, previous);
    const id = crypto.randomUUID();
    const code = await this.uniqueCode();
    const rematch = freshMatch(
      id,
      code,
      config,
      targets,
      {
        tokenHash: old.hostTokenHash,
        nickname: old.hostNickname ?? "Spēlētājs",
        guestHash: old.hostGuestHash,
      },
      nowMs,
      old.id,
    );
    rematch.match.status = "ready";
    rematch.match.guestTokenHash = old.guestTokenHash;
    rematch.match.guestNickname = old.guestNickname;
    rematch.match.guestGuestHash = old.guestGuestHash;
    await tx.createMatch(rematch.match);
    for (const round of rematch.rounds) await tx.upsertRound(round);
    mpLog("rematch-created", { matchId: id, code, rematchOf: old.id });
    return {
      ...agg,
      match: { ...agg.match, rematchWithCode: code },
    };
  }

  private pickTargets(
    targets: readonly string[],
    count: number,
    avoid: ReadonlySet<string>,
  ): string[] {
    if (process.env.NEXT_PUBLIC_E2E) {
      const fresh = targets.filter((t) => !avoid.has(t));
      return (fresh.length >= count ? fresh : targets).slice(0, count);
    }
    const available = targets.filter((t) => !avoid.has(t));
    const pool = available.length >= count ? available : targets;
    const chosen: string[] = [];
    const used = new Set<string>();
    let guard = 0;
    while (chosen.length < count && guard < 1000) {
      guard++;
      const candidate = pool[crypto.randomInt(0, pool.length)];
      if (!used.has(candidate)) {
        used.add(candidate);
        chosen.push(candidate);
      }
    }
    return chosen;
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = randomCode();
      const existing = await this.store.getMatchByCode(code);
      if (!existing) return code;
    }
    throw new LingoMpError(500, "code-generation", "Neizdevās izveidot kodu");
  }

  private async loadAggregateFrom(
    store: LingoMpStore,
    id: string,
  ): Promise<MatchAggregate | null> {
    const match = await store.getMatch(id);
    if (!match) return null;
    const rounds = await store.getRounds(id);
    const submissions = await store.getSubmissions(id);
    const events = await store.getEvents(id);
    return { match, rounds, submissions, events };
  }

  private async persistReconciledVia(
    tx: LingoMpStore,
    agg: MatchAggregate,
    nowMs: number,
  ): Promise<MatchAggregate> {
    const next = reconcile(agg, nowMs);
    if (
      matchUnchanged(agg.match, next.match) &&
      roundsUnchanged(agg.rounds, next.rounds)
    ) {
      return next;
    }
    const saved = await this.saveAggregateVia(tx, agg, next);
    return saved ?? (await this.loadAggregateFrom(tx, agg.match.id)) ?? next;
  }

  private async saveAggregateVia(
    store: LingoMpStore,
    prev: MatchAggregate,
    next: MatchAggregate,
  ): Promise<MatchAggregate | null> {
    for (let i = 0; i < next.rounds.length; i++) {
      const previous = prev.rounds[i];
      const current = next.rounds[i];
      // Upsert only changed rounds: a stale aggregate must never clobber
      // outcome columns another transaction just committed.
      if (!previous || JSON.stringify(previous) !== JSON.stringify(current)) {
        await store.upsertRound(current);
      }
    }
    for (const s of next.submissions.slice(prev.submissions.length)) {
      await store.insertSubmission(s);
    }
    for (const e of next.events.slice(prev.events.length)) {
      await store.insertEvent(e);
    }
    const patch = matchPatch(prev.match, next.match);
    if (Object.keys(patch).length === 0) {
      return { ...next, match: prev.match };
    }
    const updated = await store.updateIfVersion(
      next.match.id,
      prev.match.version,
      { ...patch, version: prev.match.version + 1 },
    );
    if (!updated) return null;
    return { ...next, match: updated };
  }

  private async maybeRecordResultVia(
    store: LingoMpStore,
    agg: MatchAggregate,
  ): Promise<void> {
    if (agg.match.status !== "finished" || !agg.match.resultJson) return;
    const result: LingoMpDbResult = {
      matchId: agg.match.id,
      resultJson: agg.match.resultJson,
      createdAt: agg.match.updatedAt,
    };
    await store.insertResult(result);
    mpLog("result-finalized", {
      matchId: agg.match.id,
      winner: agg.match.winner ?? "draw",
    });
  }
}

const MATCH_MUTABLE_FIELDS: Array<keyof LingoMpDbMatch> = [
  "status",
  "guestTokenHash",
  "hostNickname",
  "guestNickname",
  "guestGuestHash",
  "hostReady",
  "guestReady",
  "countdownEndsAt",
  "matchStartedAt",
  "currentRoundIndex",
  "roundStartedAt",
  "nextRoundStartedAt",
  "hostDeadlineAt",
  "guestDeadlineAt",
  "hostExtensionsLeft",
  "guestExtensionsLeft",
  "hostExtensionsUsedRound",
  "guestExtensionsUsedRound",
  "winner",
  "endReason",
  "resultJson",
  "rematchRequestedHost",
  "rematchRequestedGuest",
  "rematchWithCode",
  "lastActionIds",
  "lastActionAt",
  "updatedAt",
  "expiresAt",
];

function matchPatch(
  prev: LingoMpDbMatch,
  next: LingoMpDbMatch,
): Partial<LingoMpDbMatch> {
  const patch: Partial<LingoMpDbMatch> = {};
  for (const key of MATCH_MUTABLE_FIELDS) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }
  return patch;
}

function matchUnchanged(prev: LingoMpDbMatch, next: LingoMpDbMatch): boolean {
  return Object.keys(matchPatch(prev, next)).length === 0;
}

function roundsUnchanged(
  prev: readonly LingoMpDbRound[],
  next: readonly LingoMpDbRound[],
): boolean {
  return JSON.stringify(prev) === JSON.stringify(next);
}

export function toLingoActionResponse(error: unknown): LingoMpActionResponse {
  if (error instanceof LingoMpError) {
    return { ok: false, code: error.code, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, code: "internal", error: error.message };
  }
  return { ok: false, code: "internal", error: "Nezināma kļūda" };
}
