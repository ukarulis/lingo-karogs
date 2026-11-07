// Server-authoritative Lingo multiplayer engine. Pure and deterministic:
// every transition is computed from persisted state and an injected clock,
// so it runs identically on any serverless instance and is fully testable.

import { evaluateSegments, type CellStatus } from "@/lib/lingo/engine";
import { getPack } from "@/lib/lingo/pack/registry";
import type {
  MatchAggregate,
  LingoMpDbEvent,
  LingoMpDbMatch,
  LingoMpDbRound,
  LingoMpDbSubmission,
} from "./store";
import {
  type EvaluatedGuess,
  type LingoMpAction,
  type LingoMpConfig,
  type LingoMpFormat,
  type LingoMpSlot,
  type LingoMpView,
  type MatchResult,
  type PlayerRoundOutcome,
  LINGO_MP_COUNTDOWN_MS,
  LINGO_MP_PRESETS,
  LINGO_MP_ROOM_TTL_MS,
  LINGO_MP_TRANSITION_MS,
} from "./types";

export class LingoMpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const iso = (ms: number): string => new Date(ms).toISOString();
const parse = (s: string | null): number | null =>
  s === null ? null : Date.parse(s);

/**
 * Build and validate the frozen configuration for a match. Multiplayer
 * deliberately rejects unknown language packs, dictionary versions and
 * rule-set versions instead of silently substituting defaults.
 */
export function buildConfig(
  format: LingoMpFormat,
  length: number,
): LingoMpConfig {
  const preset = LINGO_MP_PRESETS[format];
  const pack = getPack("lv");
  if (!pack) {
    throw new LingoMpError(503, "language-unavailable", "Valoda nav pieejama");
  }
  if (!Number.isInteger(length) || length < 4 || length > 7) {
    throw new LingoMpError(400, "bad-length", "Nederīgs vārda garums");
  }
  return {
    format,
    language: pack.id,
    dictionaryVersion: pack.dictionaryVersion,
    ruleSetVersion: pack.ruleSetVersion,
    length,
    maxAttempts: 5,
    guessPolicy: "freeform",
    revealFirstLetter: true,
    carryConfirmedLetters: true,
    words: preset.words,
    timePerWordSec: preset.timePerWordSec,
    extensionsPerMatch: preset.extensionsPerMatch,
    extensionSeconds: 15,
    maxExtensionsPerRound: 1,
  };
}

export function validateConfigForServer(config: LingoMpConfig): void {
  const pack = getPack(config.language);
  if (!pack) {
    throw new LingoMpError(
      503,
      "language-unavailable",
      "Valodas pakotne nav pieejama",
    );
  }
  if (config.dictionaryVersion !== pack.dictionaryVersion) {
    throw new LingoMpError(
      400,
      "bad-dictionary-version",
      "Nezināma vārdnīcas versija",
    );
  }
  if (config.ruleSetVersion !== pack.ruleSetVersion) {
    throw new LingoMpError(
      400,
      "bad-ruleset-version",
      "Nezināma noteikumu versija",
    );
  }
  if (config.guessPolicy !== "freeform") {
    throw new LingoMpError(400, "bad-policy", "Nederīga minējumu politika");
  }
}

export function freshRound(
  matchId: string,
  roundIndex: number,
  word: string,
): LingoMpDbRound {
  return {
    id: `${matchId}:r${roundIndex}`,
    matchId,
    roundIndex,
    word,
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
  };
}

export function freshMatch(
  id: string,
  code: string,
  config: LingoMpConfig,
  targets: string[],
  host: { tokenHash: string; nickname: string; guestHash: string },
  nowMs: number,
  rematchOf: string | null = null,
): MatchAggregate {
  const now = iso(nowMs);
  const match: LingoMpDbMatch = {
    id,
    code,
    format: config.format,
    status: "waiting",
    configJson: JSON.stringify(config),
    targetsJson: JSON.stringify(targets),
    hostTokenHash: host.tokenHash,
    guestTokenHash: null,
    hostNickname: host.nickname,
    guestNickname: null,
    hostGuestHash: host.guestHash,
    guestGuestHash: null,
    hostReady: false,
    guestReady: false,
    countdownEndsAt: null,
    matchStartedAt: null,
    currentRoundIndex: 0,
    roundStartedAt: null,
    nextRoundStartedAt: null,
    hostDeadlineAt: null,
    guestDeadlineAt: null,
    hostExtensionsLeft: config.extensionsPerMatch,
    guestExtensionsLeft: config.extensionsPerMatch,
    hostExtensionsUsedRound: 0,
    guestExtensionsUsedRound: 0,
    winner: null,
    endReason: null,
    resultJson: null,
    rematchRequestedHost: false,
    rematchRequestedGuest: false,
    rematchOf,
    rematchWithCode: null,
    version: 0,
    lastActionIds: [],
    lastActionAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: iso(nowMs + LINGO_MP_ROOM_TTL_MS),
  };
  const rounds = targets.map((word, i) => freshRound(id, i, word));
  return { match, rounds, submissions: [], events: [] };
}

export function configOf(match: LingoMpDbMatch): LingoMpConfig {
  return JSON.parse(match.configJson) as LingoMpConfig;
}

function slotOf(match: LingoMpDbMatch, tokenHash: string): LingoMpSlot | null {
  if (match.hostTokenHash === tokenHash) return "host";
  if (match.guestTokenHash === tokenHash) return "guest";
  return null;
}

export function authorizeSlot(
  match: LingoMpDbMatch,
  tokenHash: string,
): LingoMpSlot {
  const slot = slotOf(match, tokenHash);
  if (!slot) {
    throw new LingoMpError(
      403,
      "unauthorized",
      "Nepareizs spēlētāja identifikators",
    );
  }
  return slot;
}

function currentRound(agg: MatchAggregate): LingoMpDbRound | undefined {
  return agg.rounds[agg.match.currentRoundIndex];
}

/**
 * Advance the match purely from persisted timestamps. Idempotent and safe to
 * run on every read and before every action.
 */
export function reconcile(agg: MatchAggregate, nowMs: number): MatchAggregate {
  const match = { ...agg.match };
  const rounds = agg.rounds.map((r) => ({ ...r }));
  const config = configOf(match);
  const deadline = (start: number) =>
    iso(start + config.timePerWordSec * 1000);

  const finish = (
    m: LingoMpDbMatch,
    winner: LingoMpSlot | "draw",
    reason: string,
    result: MatchResult,
  ): LingoMpDbMatch => ({
    ...m,
    status: "finished",
    winner,
    endReason: reason,
    resultJson: JSON.stringify(result),
    updatedAt: iso(nowMs),
  });

  // Empty / stale waiting rooms expire.
  if (match.status === "waiting" && nowMs >= Date.parse(match.expiresAt)) {
    return { ...agg, match: { ...match, status: "expired", updatedAt: iso(nowMs) } };
  }

  // Countdown -> first round.
  if (match.status === "countdown" && match.countdownEndsAt) {
    const ends = parse(match.countdownEndsAt);
    if (ends !== null && nowMs >= ends) {
      const round = rounds[0];
      const start = ends;
      round.startedAt = iso(start);
      round.baseDeadlineAt = deadline(start);
      round.hostDeadlineAt = deadline(start);
      round.guestDeadlineAt = deadline(start);
      return {
        ...agg,
        match: {
          ...match,
          status: "playing",
          matchStartedAt: iso(start),
          currentRoundIndex: 0,
          roundStartedAt: iso(start),
          hostDeadlineAt: round.hostDeadlineAt,
          guestDeadlineAt: round.guestDeadlineAt,
          updatedAt: iso(nowMs),
        },
        rounds,
      };
    }
    return { ...agg, match };
  }

  if (match.status !== "playing") return { ...agg, match };

  const round = rounds[match.currentRoundIndex];
  if (!round) return { ...agg, match };

  // Activate a scheduled next round.
  if (round.startedAt === null && round.nextStartAt !== null) {
    const next = parse(round.nextStartAt);
    if (next !== null && nowMs >= next) {
      round.startedAt = iso(next);
      round.baseDeadlineAt = deadline(next);
      round.hostDeadlineAt = deadline(next);
      round.guestDeadlineAt = deadline(next);
      match.roundStartedAt = iso(next);
      match.hostDeadlineAt = round.hostDeadlineAt;
      match.guestDeadlineAt = round.guestDeadlineAt;
      match.hostExtensionsUsedRound = 0;
      match.guestExtensionsUsedRound = 0;
      match.updatedAt = iso(nowMs);
    }
  }

  // Deadline expiry.
  if (round.startedAt !== null && round.resolvedAt === null) {
    const hostDeadline = parse(round.hostDeadlineAt);
    const guestDeadline = parse(round.guestDeadlineAt);
    if (
      round.hostOutcome === "playing" &&
      hostDeadline !== null &&
      nowMs >= hostDeadline
    ) {
      round.hostOutcome = "timeout";
    }
    if (
      round.guestOutcome === "playing" &&
      guestDeadline !== null &&
      nowMs >= guestDeadline
    ) {
      round.guestOutcome = "timeout";
    }
  }

  // Round resolution once both players reached a terminal outcome.
  if (
    round.resolvedAt === null &&
    round.hostOutcome !== "playing" &&
    round.guestOutcome !== "playing"
  ) {
    round.resolvedAt = iso(nowMs);
    if (round.hostOutcome === "solved") {
      round.hostScore = roundScoreWithSubs(round, "host", config, agg.submissions);
    }
    if (round.guestOutcome === "solved") {
      round.guestScore = roundScoreWithSubs(round, "guest", config, agg.submissions);
    }
    if (match.currentRoundIndex + 1 < config.words) {
      const nextIndex = match.currentRoundIndex + 1;
      const nextStart = iso(nowMs + LINGO_MP_TRANSITION_MS);
      rounds[nextIndex].nextStartAt = nextStart;
      match.currentRoundIndex = nextIndex;
      match.nextRoundStartedAt = nextStart;
      match.roundStartedAt = null;
      match.hostDeadlineAt = null;
      match.guestDeadlineAt = null;
      match.updatedAt = iso(nowMs);
    } else {
      const result = computeResult(match, rounds, config);
      return {
        ...agg,
        match: finish(match, result.winner, result.endReason, result),
        rounds,
      };
    }
  }

  return { ...agg, match, rounds };
}

export function playerAttempts(
  round: LingoMpDbRound,
  submissions: readonly LingoMpDbSubmission[],
  slot: LingoMpSlot,
): number {
  return submissions.filter((s) => s.roundId === round.id && s.player === slot)
    .length;
}

function roundScoreWithSubs(
  round: LingoMpDbRound,
  slot: LingoMpSlot,
  config: LingoMpConfig,
  submissions: readonly LingoMpDbSubmission[],
): number {
  const solvedAt =
    slot === "host" ? round.hostSolvedAt : round.guestSolvedAt;
  if (solvedAt === null) return 0;
  const started = parse(round.startedAt);
  const solved = parse(solvedAt);
  if (started === null || solved === null) return 0;
  const elapsed = Math.max(0, Math.floor((solved - started) / 1000));
  const attempts = playerAttempts(round, submissions, slot);
  const timeBonus = Math.max(0, config.timePerWordSec - elapsed);
  return 1000 + 150 * (config.maxAttempts - attempts) + timeBonus;
}

export function computeResult(
  match: LingoMpDbMatch,
  rounds: readonly LingoMpDbRound[],
  config: LingoMpConfig,
  submissions: readonly LingoMpDbSubmission[] = [],
): MatchResult {
  const rows = rounds.map((round) => {
    const hostAttempts = playerAttempts(round, submissions, "host");
    const guestAttempts = playerAttempts(round, submissions, "guest");
    return {
      index: round.roundIndex,
      word: round.word,
      host: {
        outcome: round.hostOutcome,
        attemptsUsed: hostAttempts,
        score: round.hostScore,
        elapsedSec: elapsedSec(round, "host"),
      },
      guest: {
        outcome: round.guestOutcome,
        attemptsUsed: guestAttempts,
        score: round.guestScore,
        elapsedSec: elapsedSec(round, "guest"),
      },
    };
  });
  const host = totals(rows, "host");
  const guest = totals(rows, "guest");
  let winner: LingoMpSlot | "draw" = "draw";
  if (host.score > guest.score) winner = "host";
  else if (guest.score > host.score) winner = "guest";
  else if (host.solved > guest.solved) winner = "host";
  else if (guest.solved > host.solved) winner = "guest";
  else if (host.guesses < guest.guesses) winner = "host";
  else if (guest.guesses < host.guesses) winner = "guest";
  else if (host.elapsedSec < guest.elapsedSec) winner = "host";
  else if (guest.elapsedSec < host.elapsedSec) winner = "guest";
  else winner = "draw";
  return {
    winner,
    endReason: match.endReason ?? "completed",
    host,
    guest,
    rounds: rows,
  };
}

function elapsedSec(round: LingoMpDbRound, slot: LingoMpSlot): number {
  const solvedAt =
    slot === "host" ? round.hostSolvedAt : round.guestSolvedAt;
  if (solvedAt === null || round.startedAt === null) return 0;
  const started = parse(round.startedAt);
  const solved = parse(solvedAt);
  if (started === null || solved === null) return 0;
  return Math.max(0, Math.floor((solved - started) / 1000));
}

function totals(
  rows: MatchResult["rounds"],
  slot: LingoMpSlot,
): { score: number; solved: number; guesses: number; elapsedSec: number } {
  const mine = rows.map((r) => r[slot]);
  return {
    score: mine.reduce((a, r) => a + r.score, 0),
    solved: mine.filter((r) => r.outcome === "solved").length,
    guesses: mine
      .filter((r) => r.outcome === "solved")
      .reduce((a, r) => a + r.attemptsUsed, 0),
    elapsedSec: mine
      .filter((r) => r.outcome === "solved")
      .reduce((a, r) => a + r.elapsedSec, 0),
  };
}

/** Apply one validated player action; returns the new aggregate. */
export function applyAction(
  agg: MatchAggregate,
  slot: LingoMpSlot,
  action: LingoMpAction,
  nowMs: number,
): MatchAggregate {
  const match = { ...agg.match };
  const rounds = agg.rounds.map((r) => ({ ...r }));
  const submissions = [...agg.submissions];
  const events = [...agg.events];
  const config = configOf(match);
  const now = iso(nowMs);
  const touch = () => {
    match.lastActionAt = now;
    match.updatedAt = now;
    match.lastActionIds = [...match.lastActionIds.slice(-19), action.actionId];
  };

  switch (action.type) {
    case "ready": {
      if (match.status !== "waiting" && match.status !== "ready") {
        throw new LingoMpError(400, "bad-phase", "Gatavību vairs nevar mainīt");
      }
      if (!match.guestTokenHash) {
        throw new LingoMpError(400, "no-opponent", "Pretinieks vēl nav pievienojies");
      }
      if (slot === "host") match.hostReady = true;
      else match.guestReady = true;
      if (match.hostReady && match.guestReady) {
        match.status = "countdown";
        match.countdownEndsAt = iso(nowMs + LINGO_MP_COUNTDOWN_MS);
        events.push(event(match.id, action.actionId, "countdown", slot, now));
      }
      touch();
      events.push(event(match.id, `${action.actionId}:ready`, "ready", slot, now));
      return { ...agg, match, rounds, submissions, events };
    }
    case "guess": {
      if (match.status !== "playing") {
        throw new LingoMpError(400, "bad-phase", "Raunds vēl nav sācies");
      }
      const round = rounds[match.currentRoundIndex];
      if (!round || round.startedAt === null || round.resolvedAt !== null) {
        throw new LingoMpError(400, "bad-phase", "Raunds nav aktīvs");
      }
      const outcome = slot === "host" ? round.hostOutcome : round.guestOutcome;
      if (outcome !== "playing") {
        throw new LingoMpError(400, "round-over", "Raunds jau ir beidzies");
      }
      const deadline = parse(
        slot === "host" ? round.hostDeadlineAt : round.guestDeadlineAt,
      );
      if (deadline !== null && nowMs > deadline) {
        throw new LingoMpError(400, "deadline-passed", "Laiks ir beidzies");
      }
      if (typeof action.payload?.word !== "string") {
        throw new LingoMpError(400, "bad-payload", "Trūkst minējuma");
      }
      const pack = getPack(config.language);
      if (!pack) {
        throw new LingoMpError(503, "language-unavailable", "Valoda nav pieejama");
      }
      const word = pack.normalizeInput(action.payload.word);
      const segments = pack.segmentWord(word);
      if (segments.length !== config.length || !pack.validateCharacters(word)) {
        throw new LingoMpError(400, "invalid-word", "Nederīgs minējums");
      }
      if (config.revealFirstLetter && segments[0] !== round.word[0]) {
        throw new LingoMpError(
          400,
          "wrong-first-letter",
          `Vārdam jāsākas ar burtu “${round.word[0].toUpperCase()}”`,
        );
      }
      const prior = submissions.filter(
        (s) => s.roundId === round.id && s.player === slot,
      );
      if (prior.some((s) => s.word === word)) {
        throw new LingoMpError(
          409,
          "duplicate-word",
          "Šo vārdu jau mēģināji.",
        );
      }
      if (prior.length >= config.maxAttempts) {
        throw new LingoMpError(400, "round-over", "Mēģinājumi izsmelti");
      }
      const result = evaluateSegments(segments, pack.segmentWord(round.word));
      const submission: LingoMpDbSubmission = {
        id: `${round.id}:${slot}:${prior.length + 1}`,
        roundId: round.id,
        player: slot,
        seq: prior.length + 1,
        word,
        resultJson: JSON.stringify(result),
        createdAt: now,
      };
      submissions.push(submission);
      const solved = word === round.word;
      if (solved) {
        if (slot === "host") {
          round.hostOutcome = "solved";
          round.hostSolvedAt = now;
        } else {
          round.guestOutcome = "solved";
          round.guestSolvedAt = now;
        }
      } else if (prior.length + 1 >= config.maxAttempts) {
        if (slot === "host") round.hostOutcome = "failed";
        else round.guestOutcome = "failed";
      }
      touch();
      events.push(event(match.id, `${action.actionId}:guess`, "guess", slot, now));
      return { ...agg, match, rounds, submissions, events };
    }
    case "extend": {
      if (match.status !== "playing") {
        throw new LingoMpError(400, "bad-phase", "Raunds nav aktīvs");
      }
      const round = rounds[match.currentRoundIndex];
      if (!round || round.startedAt === null || round.resolvedAt !== null) {
        throw new LingoMpError(400, "bad-phase", "Raunds nav aktīvs");
      }
      const outcome = slot === "host" ? round.hostOutcome : round.guestOutcome;
      if (outcome !== "playing") {
        throw new LingoMpError(400, "round-over", "Raunds jau ir beidzies");
      }
      const left =
        slot === "host" ? match.hostExtensionsLeft : match.guestExtensionsLeft;
      const used =
        slot === "host" ? round.hostExtensionsUsed : round.guestExtensionsUsed;
      if (left <= 0) {
        throw new LingoMpError(400, "no-extensions", "Pagarinājumi izsmelti");
      }
      if (used >= config.maxExtensionsPerRound) {
        throw new LingoMpError(
          400,
          "round-extension-cap",
          "Šajā kārtā vairs nevar pagarināt",
        );
      }
      const deadline = parse(
        slot === "host" ? round.hostDeadlineAt : round.guestDeadlineAt,
      );
      if (deadline !== null && nowMs > deadline) {
        throw new LingoMpError(
          400,
          "deadline-passed",
          "Pagarinājums iespējams tikai pirms termiņa",
        );
      }
      const newDeadline = iso(
        nowMs + config.extensionSeconds * 1000 +
          (deadline !== null && deadline > nowMs ? deadline - nowMs : 0),
      );
      if (slot === "host") {
        round.hostDeadlineAt = newDeadline;
        round.hostExtensionsUsed += 1;
        match.hostExtensionsLeft -= 1;
        match.hostDeadlineAt = newDeadline;
      } else {
        round.guestDeadlineAt = newDeadline;
        round.guestExtensionsUsed += 1;
        match.guestExtensionsLeft -= 1;
        match.guestDeadlineAt = newDeadline;
      }
      touch();
      events.push(event(match.id, `${action.actionId}:extend`, "extend", slot, now));
      return { ...agg, match, rounds, submissions, events };
    }
    case "forfeit": {
      if (match.status !== "playing") {
        throw new LingoMpError(400, "bad-phase", "Spēle nav sākta");
      }
      const other: LingoMpSlot = slot === "host" ? "guest" : "host";
      // Unresolved rounds count as failed for the forfeiting player.
      for (const round of rounds) {
        if (round.resolvedAt !== null) continue;
        round.resolvedAt = now;
        if (slot === "host") {
          round.hostOutcome = "failed";
          if (round.guestOutcome === "playing") round.guestOutcome = "failed";
          if (round.guestOutcome === "solved") {
            round.guestScore = roundScoreWithSubs(
              round,
              "guest",
              config,
              submissions,
            );
          }
        } else {
          round.guestOutcome = "failed";
          if (round.hostOutcome === "playing") round.hostOutcome = "failed";
          if (round.hostOutcome === "solved") {
            round.hostScore = roundScoreWithSubs(
              round,
              "host",
              config,
              submissions,
            );
          }
        }
      }
      const result = computeResult(match, rounds, config, submissions);
      result.winner = other;
      result.endReason = "forfeited";
      match.status = "finished";
      match.winner = other;
      match.endReason = "forfeited";
      match.resultJson = JSON.stringify(result);
      touch();
      events.push(event(match.id, `${action.actionId}:forfeit`, "forfeit", slot, now));
      return { ...agg, match, rounds, submissions, events };
    }
    case "cancel": {
      if (slot !== "host") {
        throw new LingoMpError(403, "forbidden", "Atcelt drīkst tikai īpašnieks");
      }
      if (match.status !== "waiting" && match.status !== "ready") {
        throw new LingoMpError(400, "bad-phase", "Istabu vairs nevar atcelt");
      }
      match.status = "cancelled";
      match.endReason = "cancelled";
      touch();
      return { ...agg, match, rounds, submissions, events };
    }
    case "rematch": {
      if (match.status !== "finished") {
        throw new LingoMpError(400, "bad-phase", "Revanšs iespējams tikai pēc spēles beigām");
      }
      if (!match.guestTokenHash) {
        throw new LingoMpError(400, "no-opponent", "Nav pretinieka");
      }
      if (slot === "host") match.rematchRequestedHost = true;
      else match.rematchRequestedGuest = true;
      touch();
      events.push(event(match.id, `${action.actionId}:rematch`, "rematch", slot, now));
      return { ...agg, match, rounds, submissions, events };
    }
    case "leave": {
      if (match.status !== "waiting" && match.status !== "ready") {
        throw new LingoMpError(400, "bad-phase", "Spēli vairs nevar pamest šādi");
      }
      if (slot === "host") {
        match.status = "cancelled";
        match.endReason = "host-left";
      } else {
        match.guestTokenHash = null;
        match.guestNickname = null;
        match.guestGuestHash = null;
        match.guestReady = false;
        match.hostReady = false;
        match.status = "waiting";
      }
      touch();
      return { ...agg, match, rounds, submissions, events };
    }
    default:
      throw new LingoMpError(400, "bad-action", "Nezināma darbība");
  }
}

function event(
  matchId: string,
  actionId: string,
  type: string,
  player: "host" | "guest" | "system",
  createdAt: string,
): LingoMpDbEvent {
  return {
    id: `${matchId}:${actionId}`,
    matchId,
    actionId,
    type,
    player,
    payloadJson: "{}",
    createdAt,
  };
}

/** Build the redacted per-player view from the authoritative aggregate. */
export function buildView(
  agg: MatchAggregate,
  slot: LingoMpSlot,
  nowMs: number,
): LingoMpView {
  const { match } = agg;
  const config = configOf(match);
  const round = currentRound(agg);
  const myOutcome: PlayerRoundOutcome | null =
    round === undefined ? null : slot === "host" ? round.hostOutcome : round.guestOutcome;
  const myDeadline =
    round === undefined
      ? null
      : slot === "host"
        ? round.hostDeadlineAt
        : round.guestDeadlineAt;
  const myGuesses: EvaluatedGuess[] = round
    ? agg.submissions
        .filter((s) => s.roundId === round.id && s.player === slot)
        .sort((a, b) => a.seq - b.seq)
        .map((s) => ({
          seq: s.seq,
          word: s.word,
          result: JSON.parse(s.resultJson) as CellStatus[],
          acceptedAt: s.createdAt,
        }))
    : [];
  const result = match.resultJson
    ? (JSON.parse(match.resultJson) as MatchResult)
    : null;

  const playerView = (playerSlot: LingoMpSlot) => ({
    slot: playerSlot,
    nickname: playerSlot === "host" ? match.hostNickname : match.guestNickname,
    ready: playerSlot === "host" ? match.hostReady : match.guestReady,
    connected:
      playerSlot === "host" ? true : match.guestTokenHash !== null,
    totalScore:
      result === null
        ? agg.rounds
            .filter((r) => r.resolvedAt !== null)
            .reduce(
              (sum, r) => sum + (playerSlot === "host" ? r.hostScore : r.guestScore),
              0,
            )
        : playerSlot === "host"
          ? result.host.score
          : result.guest.score,
    wordsSolved:
      result === null
        ? agg.rounds.filter(
            (r) =>
              r.resolvedAt !== null &&
              (playerSlot === "host" ? r.hostOutcome : r.guestOutcome) === "solved",
          ).length
        : playerSlot === "host"
          ? result.host.solved
          : result.guest.solved,
    extensionsLeft:
      playerSlot === "host" ? match.hostExtensionsLeft : match.guestExtensionsLeft,
  });

  const roundView = round
    ? {
        index: round.roundIndex,
        status: (
          round.resolvedAt !== null
            ? "resolved"
            : round.startedAt !== null
              ? "active"
              : "pending"
        ) as "pending" | "active" | "resolved",
        wordLength: config.length,
        firstLetter: config.revealFirstLetter ? round.word[0] : null,
        startedAt: round.startedAt,
        nextStartAt: round.nextStartAt,
        yourDeadline: myDeadline,
        yourGuesses: myGuesses,
        yourAttemptsLeft: Math.max(
          0,
          config.maxAttempts - myGuesses.length,
        ),
        yourOutcome: myOutcome ?? "playing",
        yourExtensionsUsedThisRound:
          slot === "host" ? round.hostExtensionsUsed : round.guestExtensionsUsed,
        word: round.resolvedAt !== null ? round.word : null,
        players: ["host", "guest"].map((s) => ({
          slot: s as LingoMpSlot,
          nickname: s === "host" ? match.hostNickname : match.guestNickname,
          outcome:
            s === "host" ? round.hostOutcome : round.guestOutcome,
          attemptsUsed:
            playerAttempts(round, agg.submissions, s as LingoMpSlot),
          score: s === "host" ? round.hostScore : round.guestScore,
          solvedAt: s === "host" ? round.hostSolvedAt : round.guestSolvedAt,
        })),
      }
    : null;

  const resolvedRounds = agg.rounds
    .filter((r) => r.resolvedAt !== null)
    .map((r) => ({
      index: r.roundIndex,
      status: "resolved" as const,
      wordLength: config.length,
      firstLetter: config.revealFirstLetter ? r.word[0] : null,
      startedAt: r.startedAt,
      nextStartAt: r.nextStartAt,
      yourDeadline: null,
      yourGuesses: agg.submissions
        .filter((s) => s.roundId === r.id && s.player === slot)
        .sort((a, b) => a.seq - b.seq)
        .map((s) => ({
          seq: s.seq,
          word: s.word,
          result: JSON.parse(s.resultJson) as CellStatus[],
          acceptedAt: s.createdAt,
        })),
      yourAttemptsLeft: 0,
      yourOutcome:
        slot === "host" ? r.hostOutcome : r.guestOutcome,
      yourExtensionsUsedThisRound:
        slot === "host" ? r.hostExtensionsUsed : r.guestExtensionsUsed,
      word: r.word,
      players: ["host", "guest"].map((s) => ({
        slot: s as LingoMpSlot,
        nickname: s === "host" ? match.hostNickname : match.guestNickname,
        outcome: s === "host" ? r.hostOutcome : r.guestOutcome,
        attemptsUsed: playerAttempts(r, agg.submissions, s as LingoMpSlot),
        score: s === "host" ? r.hostScore : r.guestScore,
        solvedAt: s === "host" ? r.hostSolvedAt : r.guestSolvedAt,
      })),
    }));

  return {
    matchId: match.id,
    code: match.code,
    status: match.status,
    format: match.format,
    language: config.language,
    length: config.length,
    maxAttempts: config.maxAttempts,
    words: config.words,
    timePerWordSec: config.timePerWordSec,
    extensionsPerMatch: config.extensionsPerMatch,
    extensionSeconds: config.extensionSeconds,
    version: match.version,
    serverNow: iso(nowMs),
    you: {
      slot,
      nickname: slot === "host" ? match.hostNickname : match.guestNickname,
    },
    players: [playerView("host"), playerView("guest")],
    countdownEndsAt: match.countdownEndsAt,
    currentRound: roundView,
    resolvedRounds,
    roundIndex: match.currentRoundIndex,
    totalRounds: config.words,
    result,
    rematch: {
      requestedByMe: slot === "host" ? match.rematchRequestedHost : match.rematchRequestedGuest,
      requestedByOpponent:
        slot === "host" ? match.rematchRequestedGuest : match.rematchRequestedHost,
      newCode: match.rematchWithCode,
    },
  };
}
