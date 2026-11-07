// Server-side Lingo multiplayer orchestration: room lifecycle, authorization,
// idempotent actions and authoritative persistence. Runs only on the server.

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

export { LingoMpError } from "./engine";

export function hashLingoToken(token: string): string {
  const salt = process.env.PLAYER_TOKEN_SALT ?? "lingo-karogs-v1";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${token}`)
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
    await this.persistNewAggregate(agg);
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
      const agg = await this.loadAggregateByCode(params.code);
      if (!agg) {
        throw new LingoMpError(404, "room-not-found", "Istaba nav atrasta");
      }
      const { match } = agg;
      const known =
        match.hostTokenHash === tokenHash
          ? "host"
          : match.guestTokenHash === tokenHash
            ? "guest"
            : null;
      if (known) {
        return {
          matchId: match.id,
          code: match.code,
          playerToken: params.playerToken,
          slot: known,
        };
      }
      if (match.status !== "waiting" || match.guestTokenHash) {
        throw new LingoMpError(409, "room-full", "Istaba ir pilna");
      }
      const now = Date.now();
      const updated = await this.store.updateIfVersion(match.id, match.version, {
        version: match.version + 1,
        guestTokenHash: tokenHash,
        guestNickname: nickname,
        guestGuestHash: params.guestHash,
        status: "ready",
        lastActionAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
      if (!updated) continue;
      return {
        matchId: updated.id,
        code: updated.code,
        playerToken: params.playerToken,
        slot: "guest",
      };
    }
    throw new LingoMpError(409, "conflict", "Mēģini vēlreiz");
  }

  async getView(matchId: string, playerToken: string): Promise<LingoMpView> {
    const agg = await this.loadAggregate(matchId);
    if (!agg) {
      throw new LingoMpError(404, "room-not-found", "Istaba nav atrasta");
    }
    const slot = authorizeSlot(agg.match, hashLingoToken(playerToken));
    const now = Date.now();
    const next = await this.persistReconciled(agg, now);
    return buildView(next, slot, now);
  }

  async action(
    matchId: string,
    playerToken: string,
    action: LingoMpAction,
  ): Promise<LingoMpActionResponse> {
    const tokenHash = hashLingoToken(playerToken);
    for (let attempt = 0; attempt < 4; attempt++) {
      const agg = await this.loadAggregate(matchId);
      if (!agg) {
        return { ok: false, code: "room-not-found", error: "Istaba nav atrasta" };
      }
      const slot = authorizeSlot(agg.match, tokenHash);
      // Idempotency: a repeated action returns the current state untouched.
      if (agg.match.lastActionIds.includes(action.actionId)) {
        const next = await this.persistReconciled(agg, Date.now());
        return { ok: true, view: buildView(next, slot, Date.now()) };
      }
      const now = Date.now();
      let next = reconcile(agg, now);
      const applied = applyAction(next, slot, action, now);
      next = reconcile(applied, now);

      // Both players accepted the rematch: create the new match.
      if (
        action.type === "rematch" &&
        next.match.status === "finished" &&
        next.match.rematchRequestedHost &&
        next.match.rematchRequestedGuest &&
        !next.match.rematchWithCode
      ) {
        next = await this.createRematch(next, now);
      }

      const saved = await this.saveAggregate(agg, next);
      if (!saved) continue;
      await this.maybeRecordResult(saved);
      const final = await this.persistReconciled(saved, now);
      return { ok: true, view: buildView(final, slot, now) };
    }
    return {
      ok: false,
      code: "conflict",
      error: "Vienlaicīgs pieprasījums — mēģini vēlreiz",
    };
  }

  private async createRematch(
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
    // The guest slot is pre-filled; both players ready up again.
    rematch.match.status = "ready";
    rematch.match.guestTokenHash = old.guestTokenHash;
    rematch.match.guestNickname = old.guestNickname;
    rematch.match.guestGuestHash = old.guestGuestHash;
    rematch.match.hostReady = false;
    rematch.match.guestReady = false;
    await this.persistNewAggregate(rematch);
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
      // Deterministic target selection for automated browser tests.
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

  private async loadAggregate(id: string): Promise<MatchAggregate | null> {
    const match = await this.store.getMatch(id);
    if (!match) return null;
    const rounds = await this.store.getRounds(id);
    const submissions = await this.store.getSubmissions(id);
    const events = await this.store.getEvents(id);
    return { match, rounds, submissions, events };
  }

  private async loadAggregateByCode(
    code: string,
  ): Promise<MatchAggregate | null> {
    const match = await this.store.getMatchByCode(code);
    if (!match) return null;
    return this.loadAggregate(match.id);
  }

  private async persistNewAggregate(agg: MatchAggregate): Promise<void> {
    await this.store.createMatch(agg.match);
  }

  /**
   * Persist time-driven changes (reconciliation). Returns the authoritative
   * aggregate; on a version race it returns the freshly reloaded aggregate.
   */
  private async persistReconciled(
    agg: MatchAggregate,
    nowMs: number,
  ): Promise<MatchAggregate> {
    const next = reconcile(agg, nowMs);
    if (matchUnchanged(agg.match, next.match) && roundsUnchanged(agg.rounds, next.rounds)) {
      return next;
    }
    const saved = await this.saveAggregate(agg, next);
    return saved ?? (await this.loadAggregate(agg.match.id)) ?? next;
  }

  private async saveAggregate(
    prev: MatchAggregate,
    next: MatchAggregate,
  ): Promise<MatchAggregate | null> {
    for (const round of next.rounds) {
      await this.store.upsertRound(round);
    }
    for (const s of next.submissions.slice(prev.submissions.length)) {
      await this.store.insertSubmission(s);
    }
    for (const e of next.events.slice(prev.events.length)) {
      await this.store.insertEvent(e);
    }
    const patch = matchPatch(prev.match, next.match);
    if (Object.keys(patch).length === 0) {
      // Nothing changed on the match row itself.
      return { ...next, match: prev.match };
    }
    const updated = await this.store.updateIfVersion(
      next.match.id,
      prev.match.version,
      { ...patch, version: prev.match.version + 1 },
    );
    if (!updated) return null;
    return { ...next, match: updated };
  }

  private async maybeRecordResult(agg: MatchAggregate): Promise<void> {
    if (agg.match.status !== "finished" || !agg.match.resultJson) return;
    const result: LingoMpDbResult = {
      matchId: agg.match.id,
      resultJson: agg.match.resultJson,
      createdAt: agg.match.updatedAt,
    };
    try {
      await this.store.insertResult(result);
    } catch {
      // Duplicate/ignored inserts must never fail the action.
    }
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
