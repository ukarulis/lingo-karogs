// Real PostgreSQL integration tests. Run only when the operator provides
// authorized test connections:
//   LINGO_MP_TEST_DATABASE_URL=postgresql://... (direct)
//   LINGO_MP_TEST_POOL_URL=postgresql://...    (transaction pooler, optional)
// These tests create and fully resolve matches; they do not touch any
// non-Lingo schema.

import { afterAll, describe, expect, it } from "vitest";
import { PostgresLingoMpStore } from "@/lib/lingo-mp/store-postgres";
import { LingoMultiplayerService } from "@/lib/lingo-mp/service";

const DIRECT_URL = process.env.LINGO_MP_TEST_DATABASE_URL;
const POOL_URL = process.env.LINGO_MP_TEST_POOL_URL;
const run = !!DIRECT_URL;

function makeStore(url: string, opts: Record<string, string> = {}): PostgresLingoMpStore {
  const saved = {
    url: process.env.LINGO_MP_DATABASE_URL,
    ssl: process.env.LINGO_MP_SSL,
  };
  process.env.LINGO_MP_DATABASE_URL = url;
  process.env.LINGO_MP_SSL = opts.ssl ?? "";
  try {
    return new PostgresLingoMpStore();
  } finally {
    if (saved.url) process.env.LINGO_MP_DATABASE_URL = saved.url;
    else delete process.env.LINGO_MP_DATABASE_URL;
    if (saved.ssl) process.env.LINGO_MP_SSL = saved.ssl;
    else delete process.env.LINGO_MP_SSL;
  }
}

const openStores: PostgresLingoMpStore[] = [];
const track = (s: PostgresLingoMpStore) => {
  openStores.push(s);
  return s;
};

afterAll(() => {
  for (const store of openStores) store.close?.();
});

describe.skipIf(!run)("Lingo PostgreSQL integration (direct)", () => {
  it("runs a complete quick duel with authoritative scoring", async () => {
    const store = track(makeStore(DIRECT_URL!));
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "quick-duel",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "pg-token-aaaa",
    });
    await service.joinMatch({
      code: created.code,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "pg-token-bbbb",
    });
    await service.action(created.matchId, "pg-token-aaaa", {
      actionId: "pg-ready-a",
      type: "ready",
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-ready-b",
      type: "ready",
    });
    // Fast-forward the countdown via direct store access.
    const db = (await store.getMatch(created.matchId))!;
    await store.updateIfVersion(db.id, db.version, {
      version: db.version + 1,
      countdownEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const view = await service.getView(created.matchId, "pg-token-aaaa");
    expect(view.status).toBe("playing");
    const word = view.currentRound?.word;
    expect(word).toBeNull(); // never leaked
    const first = view.currentRound?.firstLetter ?? "a";
    const target = (JSON.parse(db.targetsJson) as string[])[0];
    await service.action(created.matchId, "pg-token-aaaa", {
      actionId: "pg-guess-a",
      type: "guess",
      payload: { word: target },
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-guess-b1",
      type: "guess",
      payload: { word: `${first}bcd` },
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-guess-b2",
      type: "guess",
      payload: { word: target },
    });
    const final = await service.getView(created.matchId, "pg-token-aaaa");
    expect(final.status).toBe("finished");
    expect(final.result?.winner).toBe("host");
    expect(final.result?.host.score).toBeGreaterThan(0);
  });

  it("is idempotent under simultaneous duplicate requests", async () => {
    const store = track(makeStore(DIRECT_URL!));
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "five-word-battle",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "pg-token-aaaa",
    });
    await service.joinMatch({
      code: created.code,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "pg-token-bbbb",
    });
    const results = await Promise.all([
      service.action(created.matchId, "pg-token-aaaa", {
        actionId: "pg-dup",
        type: "ready",
      }),
      service.action(created.matchId, "pg-token-aaaa", {
        actionId: "pg-dup",
        type: "ready",
      }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    // The second player readying must not start two countdowns.
    const second = await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-ready-b",
      type: "ready",
    });
    expect(second.ok).toBe(true);
    const db = (await store.getMatch(created.matchId))!;
    expect(db.status).toBe("countdown");
  });

  it("resolves a rematch race into exactly one new match", async () => {
    const store = track(makeStore(DIRECT_URL!));
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "quick-duel",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "pg-token-aaaa",
    });
    await service.joinMatch({
      code: created.code,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "pg-token-bbbb",
    });
    await service.action(created.matchId, "pg-token-aaaa", {
      actionId: "pg-r1",
      type: "ready",
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-r2",
      type: "ready",
    });
    let db = (await store.getMatch(created.matchId))!;
    await store.updateIfVersion(db.id, db.version, {
      version: db.version + 1,
      countdownEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-forfeit",
      type: "forfeit",
    });
    // Simultaneous rematch requests from both players.
    const [ra, rb] = await Promise.all([
      service.action(created.matchId, "pg-token-aaaa", {
        actionId: "pg-rematch-a",
        type: "rematch",
      }),
      service.action(created.matchId, "pg-token-bbbb", {
        actionId: "pg-rematch-b",
        type: "rematch",
      }),
    ]);
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    db = (await store.getMatch(created.matchId))!;
    expect(db.rematchWithCode).toBeTruthy();
    const rematch = await store.getMatchByCode(db.rematchWithCode!);
    expect(rematch).not.toBeNull();
    expect(rematch!.rematchOf).toBe(created.matchId);
  });

  it("rolls back the whole transaction when a write fails", async () => {
    const store = track(makeStore(DIRECT_URL!));
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "quick-duel",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "pg-token-aaaa",
    });
    await service.joinMatch({
      code: created.code,
      nickname: "Berta",
      guestHash: "guest-b",
      playerToken: "pg-token-bbbb",
    });
    await service.action(created.matchId, "pg-token-aaaa", {
      actionId: "pg-r1",
      type: "ready",
    });
    await service.action(created.matchId, "pg-token-bbbb", {
      actionId: "pg-r2",
      type: "ready",
    });
    const db = (await store.getMatch(created.matchId))!;
    await store.updateIfVersion(db.id, db.version, {
      version: db.version + 1,
      countdownEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    // Fault injection: fail the submission write; the whole transaction
    // must roll back, leaving no partial submission or version bump.
    const failing = track(makeStore(DIRECT_URL!));
    const before = (await store.getMatch(created.matchId))!;
    const target = (JSON.parse(before.targetsJson) as string[])[0];
    const faultWord = `${target[0]}aaa`;
    const failingService = new LingoMultiplayerService(failing);
    const originalTransaction = failing.transaction.bind(failing);
    failing.transaction = (fn) =>
      originalTransaction((tx) => {
        tx.insertSubmission = () => {
          throw new Error("injected write failure");
        };
        return fn(tx);
      });
    const result = await failingService.action(
      created.matchId,
      "pg-token-aaaa",
      {
        actionId: "pg-fault",
        type: "guess",
        payload: { word: faultWord },
      },
    );
    expect(result.ok).toBe(false);
    const after = (await store.getMatch(created.matchId))!;
    expect(after.version).toBe(before.version);
    expect((await store.getSubmissions(created.matchId)).length).toBe(0);
  });

  it("denies cross-database and cross-schema access (isolation)", async () => {
    const store = track(makeStore(DIRECT_URL!));
    const denied = await store.rateLimit("probe", 1, 60);
    expect(denied.allowed).toBe(true);
    // The app user must not read unrelated cluster databases.
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: DIRECT_URL!.replace(/sslmode=[^&]*/, ""),
      ssl: {
        rejectUnauthorized: true,
        ca: Buffer.from(
          await import("node:fs").then((m) =>
            m.readFileSync("certs/digitalocean-ca.crt"),
          ),
        ),
      },
    });
    await client.connect();
    try {
      await expect(
        client.query("SELECT count(*) FROM mezakarte.cards"),
      ).rejects.toThrowError(/permission denied|does not exist/);
    } finally {
      await client.end();
    }
  });
});

describe.skipIf(!POOL_URL)("Lingo PostgreSQL integration (pooled)", () => {
  it("runs a match through the transaction pooler", async () => {
    const store = track(makeStore(POOL_URL!));
    const service = new LingoMultiplayerService(store);
    const created = await service.createMatch({
      format: "quick-duel",
      length: 4,
      nickname: "Anna",
      guestHash: "guest-a",
      playerToken: "pg-token-aaaa",
    });
    const view = await service.getView(created.matchId, "pg-token-aaaa");
    expect(view.status).toBe("waiting");
  });
});
