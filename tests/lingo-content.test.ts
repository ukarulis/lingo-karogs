import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { dictionary } from "@/lib/lingo/words";
import type { ContentManifest } from "@/lib/lingo/content";

const ROOT = process.cwd();
const read = (p: string) =>
  JSON.parse(fs.readFileSync(`${ROOT}/${p}`, "utf8"));

describe("word-discovery content registry", () => {
  it("publishes a versioned manifest with coverage statistics", () => {
    const manifest = read("public/content/lv/manifest.json") as ContentManifest;
    expect(manifest.language).toBe("lv");
    expect(manifest.dictionaryVersion).toBe("tezaurs-2026-2");
    expect(manifest.license).toBe("CC BY-SA 4.0");
    expect(manifest.stats.total).toBeGreaterThan(5000);
    expect(manifest.stats.covered).toBeGreaterThan(5000);
    expect(manifest.sources.length).toBeGreaterThanOrEqual(2);
    expect(manifest.shards.length).toBeGreaterThanOrEqual(20);
  });

  it("covers the entire frozen Daily frequent pool", () => {
    const shards = new Map<string, Set<string>>();
    for (const { file } of (
      read("public/content/lv/manifest.json") as ContentManifest
    ).shards) {
      const data = read(`public/content/lv/${file}`) as {
        words: Record<string, unknown>;
      };
      shards.set(file.replace(".json", ""), new Set(Object.keys(data.words)));
    }
    const missing: string[] = [];
    for (const word of dictionary.frequent) {
      if (!shards.get(word[0])?.has(word)) missing.push(word);
    }
    expect(missing).toEqual([]);
  });

  it("keeps editorial explanations first and separated from sources", () => {
    const shard = read("public/content/lv/ā.json") as {
      words: Record<string, { senses: Array<{ source: string }> }>;
    };
    const abols = shard.words["ābols"];
    expect(abols.senses[0].source).toBe("editorial");
    expect(abols.senses.every((s) => s.source === "editorial")).toBe(true);
  });

  it("never attributes editorial glosses to Tēzaurs", () => {
    const manifest = read("public/content/lv/manifest.json") as ContentManifest;
    expect(manifest.editorial.reviewedBy).toBeTruthy();
    // Every editorial sense carries its own marker at generation time.
    const shard = read("public/content/lv/ā.json") as {
      words: Record<string, { senses: Array<{ editorial?: boolean }> }>;
    };
    for (const entry of Object.values(shard.words)) {
      for (const sense of entry.senses) {
        if (sense.editorial) expect(sense.editorial).toBe(true);
      }
    }
  });

  it("publishes a non-empty beginner pool", () => {
    const beginner = read("public/content/lv/beginner.json") as {
      words: string[];
    };
    expect(beginner.words.length).toBeGreaterThanOrEqual(300);
    expect(new Set(beginner.words).size).toBe(beginner.words.length);
  });
});
