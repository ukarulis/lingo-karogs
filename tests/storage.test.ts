import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_SAVE_VERSION, loadGame, saveGame } from "@/lib/store/storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

type Save = { word: string; guesses: string[] };
const isSave = (raw: unknown): raw is Save =>
  !!raw &&
  typeof raw === "object" &&
  typeof (raw as Save).word === "string" &&
  Array.isArray((raw as Save).guesses);

describe("versioned game saves", () => {
  let store: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal("window", { localStorage: store });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps new saves in a versioned envelope with timestamps", () => {
    saveGame("lingoDaily", { word: "ābols", guesses: ["ābele"] }, "playing");
    const raw = JSON.parse(window.localStorage.getItem("lk.lingoDaily")!);
    expect(raw.v).toBe(GAME_SAVE_VERSION);
    expect(typeof raw.createdAt).toBe("string");
    expect(typeof raw.updatedAt).toBe("string");
    expect(raw.status).toBe("playing");
    expect(raw.data.word).toBe("ābols");
  });

  it("loads validated data and preserves the creation timestamp", async () => {
    const t0 = "2026-11-07T10:00:00.000Z";
    window.localStorage.setItem(
      "lk.lingoDaily",
      JSON.stringify({
        v: GAME_SAVE_VERSION,
        createdAt: t0,
        updatedAt: t0,
        status: "playing",
        data: { word: "ābols", guesses: [] },
      }),
    );
    const loaded = loadGame<Save>("lingoDaily", isSave);
    expect(loaded?.data.word).toBe("ābols");
    expect(loaded?.meta.createdAt).toBe(t0);

    await new Promise((r) => setTimeout(r, 5));
    saveGame("lingoDaily", { word: "ābols", guesses: ["ābele"] }, "playing");
    const again = JSON.parse(window.localStorage.getItem("lk.lingoDaily")!);
    expect(again.createdAt).toBe(t0);
    expect(again.updatedAt).not.toBe(t0);
  });

  it("accepts legacy V1.0/V1.1 unwrapped payloads", () => {
    window.localStorage.setItem(
      "lk.lingoEndless",
      JSON.stringify({ word: "ābols", guesses: ["ābele"], extra: true }),
    );
    const loaded = loadGame<Save>("lingoEndless", isSave);
    expect(loaded?.data.word).toBe("ābols");
    expect(loaded?.meta.v).toBe(1);
  });

  it("removes only the broken game key on invalid data", () => {
    window.localStorage.setItem("lk.lingoDaily", JSON.stringify({ word: 42 }));
    window.localStorage.setItem("lk.karogsStats", JSON.stringify([{ id: "1" }]));
    const loaded = loadGame<Save>("lingoDaily", isSave);
    expect(loaded).toBeNull();
    expect(window.localStorage.getItem("lk.lingoDaily")).toBeNull();
    expect(window.localStorage.getItem("lk.karogsStats")).not.toBeNull();
  });

  it("recovers from corrupted JSON without crashing", () => {
    window.localStorage.setItem("lk.lingoArcade", "{not-json");
    const loaded = loadGame<Save>("lingoArcade", isSave);
    expect(loaded).toBeNull();
  });

  it("refuses future schema versions without destroying them", () => {
    window.localStorage.setItem(
      "lk.lingoDaily",
      JSON.stringify({
        v: GAME_SAVE_VERSION + 1,
        createdAt: "2026-11-07T10:00:00.000Z",
        updatedAt: "2026-11-07T10:00:00.000Z",
        status: null,
        data: { word: "ābols", guesses: [] },
      }),
    );
    const loaded = loadGame<Save>("lingoDaily", isSave);
    expect(loaded).toBeNull();
    expect(window.localStorage.getItem("lk.lingoDaily")).not.toBeNull();
  });

  it("handles quota failures gracefully by continuing in-memory", () => {
    vi.spyOn(store, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveGame("lingoDaily", { word: "ābols", guesses: [] })).not.toThrow();
  });
});
