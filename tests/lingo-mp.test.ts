import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  LingoMpError,
  applyAction,
  authorizeSlot,
  buildConfig,
  buildView,
  freshMatch,
  reconcile,
  validateConfigForServer,
} from "@/lib/lingo-mp/engine";
import {
  LingoMultiplayerService,
} from "@/lib/lingo-mp/service";
import type { MatchAggregate } from "@/lib/lingo-mp/store";
import { SqliteLingoMpStore } from "@/lib/lingo-mp/store-sqlite";

const HOST = { tokenHash: "host-hash", nickname: "Anna", guestHash: "guest-a" };
const GUEST = { tokenHash: "guest-hash", nickname: "Berta", guestHash: "guest-b" };

function joinedAggregate(
  config: ReturnType<typeof buildConfig>,
  targets: string[],
  nowMs: number,
): MatchAggregate {
  const agg = freshMatch("m1", "ABCDEF", config, targets, HOST, nowMs);
  agg.match.guestTokenHash = GUEST.tokenHash;
  agg.match.guestNickname = GUEST.nickname;
  agg.match.guestGuestHash = GUEST.guestHash;
  agg.match.status = "ready";
  return agg;
}

function act(agg: MatchAggregate, slot: "host" | "guest", type: string, now: number, id: string, payload?: { word?: string }): MatchAggregate {
  return applyAction(
    agg,
    slot,
    { actionId: id, type: type as never, payload },
    now,
  );
}

describe("lingo multiplayer config validation", () => {
  it("builds the documented presets", () => {
    const qd = buildConfig("quick-duel", 5);
    expect(qd.words).toBe(1);
    expect(qd.timePerWordSec).toBe(60);
    expect(qd.extensionsPerMatch).toBe(0);
    const fw = buildConfig("five-word-battle", 5);
    expect(fw.words).toBe(5);
    expect(fw.timePerWordSec).toBe(90);
    expect(fw.extensionsPerMatch).toBe(3);
  });

  it("rejects unknown language packs, dictionaries and rule sets", () => {
    const config = buildConfig("quick-duel", 4);
    validateConfigForServer(config);
    expect(() =>
      validateConfigForServer({ ...config, language: "xx" }),
    ).toThrowError(LingoMpError);
    expect(() =>
      validateConfigForServer({ ...config, dictionaryVersion: "ancient" }),
    ).toThrowError(LingoMpError);
    expect(() =>
      validateConfigForServer({ ...config, ruleSetVersion: "future" }),
    ).toThrowError(LingoMpError);
    expect(() => buildConfig("quick-duel", 3)).toThrowError(LingoMpError);
  });
});

describe("quick duel lifecycle", () => {
  it("plays a full duel with deterministic scoring and redacted views", () => {
    const config = buildConfig("quick-duel", 4);
    const t0 = 1_000_000_000_000;
    let agg = joinedAggregate(config, ["akls"], t0);

    agg = act(agg, "host", "ready", t0 + 1000, "r1");
    expect(agg.match.status).toBe("ready");
    agg = act(agg, "guest", "ready", t0 + 2000, "r2");
    expect(agg.match.status).toBe("countdown");
    expect(agg.match.countdownEndsAt).not.toBeNull();

    const countdownEnd = Date.parse(agg.match.countdownEndsAt!);
    agg = reconcile(agg, countdownEnd);
    expect(agg.match.status).toBe("playing");
    const round = agg.rounds[0];
    expect(round.startedAt).not.toBeNull();

    const start = Date.parse(round.startedAt!);
    // Host solves on the first attempt after 5 seconds.
    agg = act(agg, "host", "guess", start + 5000, "g1", { word: "akls" });
    expect(agg.rounds[0].hostOutcome).toBe("solved");
    // Guest uses two attempts, solving after 9 seconds.
    agg = act(agg, "guest", "guess", start + 6000, "g2", { word: "akla" });
    expect(agg.rounds[0].guestOutcome).toBe("playing");

    // Before the guest solves, their view must not contain the target, and
    // the host's own solved guess stays private to the host.
    const guestView = buildView(agg, "guest", start + 6100);
    expect(guestView.currentRound?.word).toBeNull();
    expect(JSON.stringify(guestView)).not.toContain('"akls"');
    expect(guestView.currentRound?.yourGuesses.map((g) => g.word)).toEqual([
      "akla",
    ]);
    const hostView = buildView(agg, "host", start + 6100);
    expect(hostView.currentRound?.yourGuesses.map((g) => g.word)).toEqual([
      "akls",
    ]);

    agg = act(agg, "guest", "guess", start + 9000, "g3", { word: "akls" });
    agg = reconcile(agg, start + 9001);
    expect(agg.match.status).toBe("finished");
    expect(agg.match.winner).toBe("host");
    expect(agg.rounds[0].hostScore).toBe(1000 + 150 * 4 + 55);
    expect(agg.rounds[0].guestScore).toBe(1000 + 150 * 3 + 51);

    const finalView = buildView(agg, "guest", start + 9002);
    expect(finalView.currentRound?.word).toBe("akls");
    expect(finalView.result?.winner).toBe("host");
    expect(finalView.result?.host.score).toBeGreaterThan(
      finalView.result?.guest.score ?? 0,
    );
  });

  it("times out a player on the authoritative deadline and draws if nobody solves", () => {
    const config = buildConfig("quick-duel", 4);
    const t0 = 2_000_000_000_000;
    let agg = joinedAggregate(config, ["akls"], t0);
    agg = act(agg, "host", "ready", t0, "r1");
    agg = act(agg, "guest", "ready", t0, "r2");
    agg = reconcile(agg, Date.parse(agg.match.countdownEndsAt!));
    const deadline = Date.parse(agg.rounds[0].hostDeadlineAt!);
    // Host solves; the guest never acts and times out on the deadline.
    const start = Date.parse(agg.rounds[0].startedAt!);
    agg = act(agg, "host", "guess", start + 1000, "g1", { word: "akls" });
    agg = reconcile(agg, deadline + 1);
    expect(agg.rounds[0].hostOutcome).toBe("solved");
    expect(agg.rounds[0].guestOutcome).toBe("timeout");
    expect(agg.match.status).toBe("finished");
    expect(agg.match.winner).toBe("host");

    // Nobody acting at all: both time out -> draw.
    let idle = joinedAggregate(config, ["akls"], t0);
    idle = act(idle, "host", "ready", t0, "r1");
    idle = act(idle, "guest", "ready", t0, "r2");
    idle = reconcile(idle, Date.parse(idle.match.countdownEndsAt!) + 1);
    const idleDeadline = Date.parse(idle.rounds[0].hostDeadlineAt!);
    idle = reconcile(idle, idleDeadline + 1);
    expect(idle.match.winner).toBe("draw");
  });

  it("rejects guesses after the deadline, duplicates and invalid words", () => {
    const config = buildConfig("quick-duel", 4);
    const t0 = 3_000_000_000_000;
    let agg = joinedAggregate(config, ["akls"], t0);
    agg = act(agg, "host", "ready", t0, "r1");
    agg = act(agg, "guest", "ready", t0, "r2");
    agg = reconcile(agg, Date.parse(agg.match.countdownEndsAt!));
    const start = Date.parse(agg.rounds[0].startedAt!);
    agg = act(agg, "host", "guess", start + 1000, "g1", { word: "akla" });
    expect(() =>
      act(agg, "host", "guess", start + 2000, "g2", { word: "akla" }),
    ).toThrowError(/jau mēģināji/);
    expect(() =>
      act(agg, "host", "guess", start + 3000, "g3", { word: "balt" }),
    ).toThrowError(/jāsākas/);
    expect(() =>
      act(agg, "host", "guess", start + 61_000, "g4", { word: "akle" }),
    ).toThrowError(/Laiks ir beidzies/);
    // A guess against an inactive match is rejected.
    const waiting = joinedAggregate(buildConfig("quick-duel", 4), ["akls"], t0);
    expect(() =>
      act(waiting, "host", "guess", t0, "g5", { word: "akls" }),
    ).toThrowError(/Raunds vēl nav sācies/);
  });

  it("never leaks the target or opponent guesses in serialized views", () => {
    const config = buildConfig("quick-duel", 4);
    const t0 = 4_000_000_000_000;
    let agg = joinedAggregate(config, ["akls"], t0);
    agg = act(agg, "host", "ready", t0, "r1");
    agg = act(agg, "guest", "ready", t0, "r2");
    agg = reconcile(agg, Date.parse(agg.match.countdownEndsAt!));
    const start = Date.parse(agg.rounds[0].startedAt!);
    agg = act(agg, "guest", "guess", start + 1000, "g1", { word: "aklu" });
    const view = buildView(agg, "host", start + 2000);
    expect(JSON.stringify(view)).not.toContain("aklu");
    expect(JSON.stringify(view)).not.toContain("akls");
    expect(view.players.find((p) => p.slot === "guest")?.wordsSolved).toBe(0);
  });
});

describe("five-word battle: extensions and progression", () => {
  function startBattle(now: number) {
    const config = buildConfig("five-word-battle", 5);
    let agg = freshMatch("b1", "BBCDEF", config, ["abols", "asara", "avene", "acite", "airis"], HOST, now);
    agg.match.guestTokenHash = GUEST.tokenHash;
    agg.match.guestNickname = GUEST.nickname;
    agg.match.guestGuestHash = GUEST.guestHash;
    agg.match.status = "ready";
    agg = act(agg, "host", "ready", now, "r1");
    agg = act(agg, "guest", "ready", now + 1, "r2");
    agg = reconcile(agg, Date.parse(agg.match.countdownEndsAt!) + 1);
    return agg;
  }

  it("grants at most one extension per round and tracks the match budget", () => {
    let agg = startBattle(5_000_000_000_000);
    const start = Date.parse(agg.rounds[0].startedAt!);
    const baseDeadline = Date.parse(agg.rounds[0].hostDeadlineAt!);
    expect(baseDeadline - start).toBe(90_000);
    expect(agg.match.hostExtensionsLeft).toBe(3);

    agg = act(agg, "host", "extend", start + 1000, "e1");
    const extended = Date.parse(agg.rounds[0].hostDeadlineAt!);
    expect(extended).toBe(baseDeadline + 15_000);
    expect(agg.match.hostExtensionsLeft).toBe(2);
    expect(agg.rounds[0].hostExtensionsUsed).toBe(1);

    expect(() => act(agg, "host", "extend", start + 2000, "e2")).toThrowError(
      /vairs nevar pagarināt/,
    );
    agg = act(agg, "guest", "extend", start + 3000, "e3");
    expect(agg.match.guestExtensionsLeft).toBe(2);
    expect(() => act(agg, "guest", "extend", start + 4000, "e4")).toThrowError(
      /vairs nevar pagarināt/,
    );
    // After the original deadline the host still plays on the extension,
    // but the guest (who did not extend) times out.
    agg = reconcile(agg, baseDeadline + 1000);
    expect(agg.rounds[0].hostOutcome).toBe("playing");
    expect(agg.rounds[0].guestOutcome).toBe("playing");
    // After the extended deadline the host times out and the round resolves
    // as a draw.
    agg = reconcile(agg, extended + 1);
    expect(agg.rounds[0].hostOutcome).toBe("timeout");
    expect(agg.rounds[0].guestOutcome).toBe("timeout");
    expect(agg.rounds[0].resolvedAt).not.toBeNull();
    expect(agg.match.status).toBe("playing");
    expect(agg.match.currentRoundIndex).toBe(1);
  });

  it("never lets an extension add time-bonus points", () => {
    let agg = startBattle(6_000_000_000_000);
    const start = Date.parse(agg.rounds[0].startedAt!);
    // Host solves 2 seconds before the original deadline, using 2 guesses.
    agg = act(agg, "host", "guess", start + 1000, "g1", { word: "abala" });
    agg = act(agg, "host", "guess", start + 88_000, "g2", { word: "abols" });
    expect(agg.rounds[0].hostOutcome).toBe("solved");
    // Guest fails all five and the round resolves.
    for (let i = 0; i < 5; i++) {
      agg = act(agg, "guest", "guess", start + 2000 + i * 1000, `gg${i}`, {
        word: `ab${"cdefg".charAt(i)}de`,
      });
    }
    agg = reconcile(agg, start + 88_001);
    // Elapsed 88s, 2 attempts: bonus uses the ORIGINAL 90s base.
    expect(agg.rounds[0].hostScore).toBe(1000 + 150 * 3 + Math.max(0, 90 - 88));
    expect(agg.rounds[0].guestScore).toBe(0);
    expect(agg.match.status).toBe("playing");
    expect(agg.match.currentRoundIndex).toBe(1);
  });

  it("progresses through all rounds and finishes with cumulative totals", () => {
    let agg = startBattle(7_000_000_000_000);
    const targets = ["abols", "asara", "avene", "acite", "airis"];
    for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
      const start = Date.parse(agg.rounds[roundIdx].startedAt!);
      // Host solves with one guess quickly; guest never acts and times out.
      agg = act(agg, "host", "guess", start + 500, `hs${roundIdx}`, {
        word: targets[roundIdx],
      });
      const guestDeadline = Date.parse(agg.rounds[roundIdx].guestDeadlineAt!);
      agg = reconcile(agg, guestDeadline + 1);
      if (roundIdx < 4) {
        // Advance past the between-round transition.
        agg = reconcile(agg, Date.parse(agg.rounds[roundIdx + 1].nextStartAt!) + 1);
        expect(agg.rounds[roundIdx + 1].startedAt).not.toBeNull();
      }
    }
    expect(agg.match.status).toBe("finished");
    const result = JSON.parse(agg.match.resultJson!);
    expect(result.winner).toBe("host");
    expect(result.host.solved).toBe(5);
    expect(result.guest.solved).toBe(0);
    expect(result.host.score).toBeGreaterThan(0);
    expect(result.guest.score).toBe(0);
  });

  it("carries stable round identities and distinguishes consecutive rounds", () => {
    let agg = startBattle(8_100_000_000_000);
    const view1 = buildView(agg, "host", 8_100_000_000_500);
    const firstId = view1.currentRound!.id;
    expect(firstId).toBe(`${agg.match.id}:r0`);
    // Same view twice -> same identity (stable across snapshots).
    expect(buildView(agg, "host", 8_100_000_000_600).currentRound!.id).toBe(
      firstId,
    );
    // Complete round 1 (both fail fast) and advance to round 2.
    const start = Date.parse(agg.rounds[0].startedAt!);
    for (let i = 0; i < 5; i++) {
      const ch = "cdefg"[i];
      agg = act(agg, "host", "guess", start + i * 100, `hs${i}`, {
        word: `ab${ch}de`,
      });
      agg = act(agg, "guest", "guess", start + i * 100 + 10, `gs${i}`, {
        word: `ab${ch}df`,
      });
    }
    agg = reconcile(agg, start + 1000);
    expect(agg.match.currentRoundIndex).toBe(1);
    agg = reconcile(agg, Date.parse(agg.rounds[1].nextStartAt!) + 1);
    const view2 = buildView(agg, "host", start + 100_000);
    expect(view2.currentRound!.id).toBe(`${agg.match.id}:r1`);
    expect(view2.currentRound!.id).not.toBe(firstId);
    // The resolved first round keeps its own identity in history.
    expect(view2.resolvedRounds[0].id).toBe(firstId);
  });
});

describe("forfeit and unauthorized access", () => {
  it("forfeiting ends the match and awards the opponent", () => {
    const config = buildConfig("quick-duel", 4);
    let agg = joinedAggregate(config, ["akls"], 8_000_000_000_000);
    agg = act(agg, "host", "ready", 8_000_000_000_000, "r1");
    agg = act(agg, "guest", "ready", 8_000_000_000_000, "r2");
    agg = reconcile(agg, Date.parse(agg.match.countdownEndsAt!) + 1);
    agg = act(agg, "host", "forfeit", Date.parse(agg.match.matchStartedAt!) + 1000, "f1");
    expect(agg.match.status).toBe("finished");
    expect(agg.match.winner).toBe("guest");
    expect(agg.match.endReason).toBe("forfeited");
    expect(JSON.parse(agg.match.resultJson!).winner).toBe("guest");
  });

  it("rejects unknown player tokens", () => {
    const agg = joinedAggregate(buildConfig("quick-duel", 4), ["akls"], 9_000_000_000_000);
    expect(() => authorizeSlot(agg.match, "intruder")).toThrowError(LingoMpError);
  });
});

describe("service persistence, idempotency and rematch (SQLite)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lingo-mp-test-"));
  const dbPath = path.join(dir, "test.db");
  const stores: SqliteLingoMpStore[] = [];
  const newStore = () => {
    const store = new SqliteLingoMpStore(dbPath);
    stores.push(store);
    return store;
  };
  afterAll(() => {
    for (const store of stores) store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates, joins, plays, persists across a store restart and rematches", async () => {
    const store = newStore();
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "five-word-battle",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "token-aaaa-aaaa",
    });
    const joined = await service.joinMatch({
      code: created.code,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "token-bbbb-bbbb",
    });
    expect(joined.slot).toBe("guest");

    // Host readies; duplicate ready action is idempotent.
    const readyA = await service.action(created.matchId, "token-aaaa-aaaa", {
      actionId: "action-ready-a",
      type: "ready",
    });
    expect(readyA.ok).toBe(true);
    const readyAgain = await service.action(created.matchId, "token-aaaa-aaaa", {
      actionId: "action-ready-a",
      type: "ready",
    });
    expect(readyAgain.ok).toBe(true);
    await service.action(created.matchId, "token-bbbb-bbbb", {
      actionId: "action-ready-b",
      type: "ready",
    });

    // Fast-forward the countdown by rewriting the stored timestamp.
    const db = await store.getMatch(created.matchId);
    await store.updateIfVersion(db!.id, db!.version, {
      version: db!.version + 1,
      countdownEndsAt: new Date(Date.now() - 1000).toISOString(),
    });

    const playingView = await service.getView(created.matchId, "token-aaaa-aaaa");
    expect(playingView.status).toBe("playing");
    const word = (playingView.currentRound?.firstLetter ?? "a") + "aaa";
    // Idempotent duplicate submission must not consume extra attempts.
    const guess1 = await service.action(created.matchId, "token-aaaa-aaaa", {
      actionId: "action-guess-1",
      type: "guess",
      payload: { word },
    });
    expect(guess1.ok).toBe(true);
    const guessAgain = await service.action(created.matchId, "token-aaaa-aaaa", {
      actionId: "action-guess-1",
      type: "guess",
      payload: { word },
    });
    expect(guessAgain.ok).toBe(true);
    expect(guessAgain.view?.currentRound?.yourGuesses.length).toBe(1);

    // A fresh service instance over the same database restores everything.
    const service2 = new LingoMultiplayerService(newStore());
    const recovered = await service2.getView(created.matchId, "token-bbbb-bbbb");
    expect(recovered.status).toBe("playing");
    expect(recovered.players.find((p) => p.slot === "host")?.nickname).toBe("Anna");

    // Guest forfeits to reach a finished state.
    await service2.action(created.matchId, "token-bbbb-bbbb", {
      actionId: "action-forfeit",
      type: "forfeit",
    });
    const finished = await service2.getView(created.matchId, "token-aaaa-aaaa");
    expect(finished.status).toBe("finished");
    expect(finished.result).not.toBeNull();

    // Both request a rematch: the service creates a new match with fresh
    // targets and reset extension budgets.
    await service2.action(created.matchId, "token-aaaa-aaaa", {
      actionId: "action-rematch-a",
      type: "rematch",
    });
    const afterBoth = await service2.action(created.matchId, "token-bbbb-bbbb", {
      actionId: "action-rematch-b",
      type: "rematch",
    });
    expect(afterBoth.ok).toBe(true);
    const newCode = afterBoth.view?.rematch.newCode;
    expect(newCode).toBeTruthy();
    const rematchDb = await store.getMatchByCode(newCode!);
    expect(rematchDb).not.toBeNull();
    expect(rematchDb!.rematchOf).toBe(created.matchId);
    expect(rematchDb!.hostExtensionsLeft).toBe(3);
    expect(JSON.parse(rematchDb!.targetsJson)).not.toEqual(
      JSON.parse(db!.targetsJson),
    );
    // The guest can join the rematch with their existing token.
    const rejoined = await service2.joinMatch({
      code: newCode!,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "token-bbbb-bbbb",
    });
    expect(rejoined.matchId).toBe(rematchDb!.id);
    expect(rejoined.slot).toBe("guest");
  });

  it("rejects forged tokens and cross-room actions", async () => {
    const store = newStore();
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "quick-duel",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "token-cccc-cccc",
    });
    await expect(
      service.getView(created.matchId, "token-intruder"),
    ).rejects.toThrowError(/identifikators/);
    await expect(
      service.action(created.matchId, "token-intruder", {
        actionId: "forged",
        type: "guess",
        payload: { word: "akls" },
      }),
    ).rejects.toThrowError(/identifikators/);
  });
});
