// Reproducible word-discovery content pipeline.
//
// Reads the frozen dictionary pools and the Tēzaurs/CLARIN LMF data, and
// writes per-letter shards with definitions, examples, difficulty and
// source metadata. This script ONLY reads the dictionaries — it never
// regenerates or reorders them, so the frozen Daily mapping is untouched.
//
// Sources (CC BY-SA 4.0, see data/NOTICE.md):
//  - Tēzaurs.lv 2026 Latvian WordNet (LMF/XML), handle 20.500.12574/156
//  - Latvian word frequency dataset (25K), handle 20.500.12574/148

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data-src");
const OUT_DIR = path.join(ROOT, "public", "content", "lv");
const DICT_DIR = path.join(ROOT, "src", "lib", "lingo", "data");
const CONTENT_VERSION = "tezaurs-2026-2-content-1";
const EDITORIAL_PATH = path.join(ROOT, "scripts", "content-editorial.json");

function decodeXml(s) {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function readZipEntry(zipPath, entryName) {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith(entryName));
  if (!entry) throw new Error(`Entry not found in ${zipPath}: ${entryName}`);
  return entry.getData().toString("utf8");
}

function clean(text) {
  return decodeXml(text).replace(/\s+/g, " ").trim();
}

function clip(text, max) {
  const trimmed = clean(text);
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max).replace(/[^\p{L}\p{N}]+$/u, "");
  return `${cut}…`;
}

function main() {
  const xml = readZipEntry(
    path.join(SRC_DIR, "tezaurs-lmf.zip"),
    "tezaurs_2026_2_lmf.xml",
  );
  const freqTsv = fs.readFileSync(
    path.join(SRC_DIR, "frequencies-lv-25K.tsv"),
    "utf8",
  );
  const editorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, "utf8"));
  const overrides = editorial.overrides ?? {};

  // Lemma -> [{pos, senses:[synsetId]}]
  const lemmas = new Map();
  const lemmaSet = new Set();
  for (const m of xml.matchAll(/<LexicalEntry[^>]*>([\s\S]*?)<\/LexicalEntry>/g)) {
    const lemmaMatch = m[1].match(
      /<Lemma\s+writtenForm="([^"]*)"\s+partOfSpeech="([^"]*)"/,
    );
    if (!lemmaMatch) continue;
    const word = clean(lemmaMatch[1]);
    const pos = lemmaMatch[2];
    const senses = [...m[1].matchAll(/<Sense[^>]*synset="([^"]*)"/g)].map((s) =>
      s[1],
    );
    if (!lemmas.has(word)) lemmas.set(word, []);
    lemmas.get(word).push({ pos, senses });
    lemmaSet.add(word.toLowerCase());
  }

  // synset -> {definitions:[], examples:[{text, source}]}
  const synsets = new Map();
  for (const m of xml.matchAll(/<Synset\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/Synset>/g)) {
    const id = m[1];
    const body = m[2];
    const definitions = [...body.matchAll(/<Definition>([\s\S]*?)<\/Definition>/g)]
      .map((d) => clip(d[1], 240));
    const examples = [...body.matchAll(/<Example(?:\s+source="([^"]*)")?>([\s\S]*?)<\/Example>/g)]
      .map((e) => ({ text: clip(e[2], 180), source: e[1] ? clean(e[1]) : null }));
    synsets.set(id, { definitions, examples });
  }

  // Frequency ranks (first occurrence, mirroring the dictionary pipeline).
  const freqRank = new Map();
  let rank = 0;
  for (const line of freqTsv.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("Lemma")) continue;
    const [lemma, pos, freq] = line.split("\t");
    if (!lemma || !pos || !Number.isFinite(Number(freq))) continue;
    const key = lemma.toLowerCase();
    if (!freqRank.has(key)) {
      freqRank.set(key, rank);
      rank++;
    }
  }

  // Collect the eligible words from the frozen pools.
  const pools = [];
  pools.push(JSON.parse(fs.readFileSync(path.join(DICT_DIR, "dictionary.json"), "utf8")).targets);
  for (const n of [4, 6, 7]) {
    pools.push(
      JSON.parse(
        fs.readFileSync(path.join(DICT_DIR, "lv", `length-${n}.json`), "utf8"),
      ).targets,
    );
  }
  const frequent = new Set([
    ...JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, "dictionary.json"), "utf8"),
    ).frequent,
    ...(JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, "lv", "length-4.json"), "utf8"),
    ).frequent),
    ...(JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, "lv", "length-6.json"), "utf8"),
    ).frequent),
    ...(JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, "lv", "length-7.json"), "utf8"),
    ).frequent),
  ]);

  const words = [...new Set(pools.flat())].sort();
  const shards = new Map();
  const stats = { total: words.length, covered: 0, senses: 0, examples: 0 };
  const beginnerWords = [];

  for (const word of words) {
    const entries = lemmas.get(word) ?? [];
    const senses = [];
    const seen = new Set();
    for (const entry of entries) {
      for (const synsetId of entry.senses) {
        const synset = synsets.get(synsetId);
        if (!synset || synset.definitions.length === 0) continue;
        const key = synset.definitions.join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        // Heuristic: drop glosses that are a single token naming a DIFFERENT
        // lemma (WordNet member noise, e.g. "āboliņš" under "ābols").
        if (
          synset.definitions.every(
            (d) =>
              !/\s/.test(d) &&
              d.toLowerCase() !== word.toLowerCase() &&
              lemmaSet.has(d.toLowerCase()),
          )
        ) {
          continue;
        }
        senses.push({
          definition: synset.definitions.slice(0, 2),
          example: synset.examples[0] ?? null,
          pos: entry.pos,
          source: "tezaurs",
        });
        if (senses.length >= 3) break;
      }
      if (senses.length >= 3) break;
    }
    const override = overrides[word];
    let finalSenses = senses;
    if (override) {
      const editorialSenses = override.senses.map((s) => ({
        definition: s.definition,
        example: s.example ?? null,
        pos: s.pos,
        source: "editorial",
        editorial: true,
      }));
      finalSenses =
        override.mode === "replace"
          ? editorialSenses
          : [...editorialSenses, ...senses].slice(0, 3);
    }
    if (finalSenses.length === 0) continue;
    const rankValue = freqRank.get(word);
    const difficulty = frequent.has(word)
      ? rankValue !== undefined && rankValue <= 1500
        ? "beginner"
        : "standard"
      : "challenging";
    const initial = word[0];
    if (!shards.has(initial)) shards.set(initial, {});
    shards.get(initial)[word] = { senses: finalSenses, difficulty };
    if (difficulty === "beginner") beginnerWords.push(word);
    stats.covered++;
    stats.senses += senses.length;
    if (finalSenses.some((s) => s.example)) stats.examples++;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shardFiles = [];
  for (const [initial, data] of shards) {
    const file = `${initial}.json`;
    fs.writeFileSync(
      path.join(OUT_DIR, file),
      JSON.stringify({ version: CONTENT_VERSION, words: data }),
      "utf8",
    );
    shardFiles.push({ file, words: Object.keys(data).length });
  }

  const manifest = {
    version: CONTENT_VERSION,
    language: "lv",
    dictionaryVersion: "tezaurs-2026-2",
    generatedAt: new Date().toISOString(),
    license: "CC BY-SA 4.0",
    sources: [
      {
        name: "Tēzaurs.lv 2026 — Latviešu valodas WordNet (LMF/XML)",
        handle: "20.500.12574/156",
        license: "CC BY-SA 4.0",
        link: "https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156",
      },
      {
        name: "Latviešu valodas vārdu biežuma datu kopa (25K)",
        handle: "20.500.12574/148",
        license: "CC BY-SA 4.0",
        link: "https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148",
      },
    ],
    difficulty: {
      beginner: "biežuma rangs ≤ 1500 un vārds ir Dienas biežuma kopā",
      standard: "Dienas biežuma kopa",
      challenging: "pārējie mērķvārdi",
    },
    stats,
    editorial: {
      reviewedBy: editorial.reviewedBy,
      overriddenWords: Object.keys(overrides).length,
    },
    shards: shardFiles.sort((a, b) => a.file.localeCompare(b.file)),
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "beginner.json"),
    JSON.stringify({
      version: CONTENT_VERSION,
      language: "lv",
      words: beginnerWords.sort(),
    }),
    "utf8",
  );

  console.log(
    `content: ${stats.covered}/${stats.total} words, ${stats.senses} senses, ` +
      `${stats.examples} with examples, ${shardFiles.length} shards`,
  );
  console.log(
    `beginner pool: ${beginnerWords.length} words`,
  );
}

main();
