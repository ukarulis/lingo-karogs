// Reproducible multi-length Latvian dictionary generation for Lingo.
//
// Sources (all CC BY-SA 4.0, see data/NOTICE.md):
//  - Tezaurs.lv 2026 (Spring) open data - Latvian WordNet in LMF/XML
//    https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156
//  - Tezaurs.lv 2026 wordforms (ispell newline list), same item
//  - Latvian word frequency dataset (25K), CLARIN-LV
//    https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148
//
// Outputs:
//  - src/lib/lingo/data/lv/manifest.json       pack metadata + quality stats
//  - src/lib/lingo/data/lv/length-{4,5,6,7}.json  per-length word pools
//  - src/lib/lingo/data/dictionary.json        legacy 5-letter pool (frozen)
//  - data/DICTIONARY_REPORT.md                 documented policy + statistics
//
// The five-letter pools are frozen: generation aborts if the sets would
// change, because the Daily puzzle identity depends on their exact contents.

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data-src");
const OUT_DIR = path.join(ROOT, "src", "lib", "lingo", "data");
const LV_OUT_DIR = path.join(OUT_DIR, "lv");

const VERSION = "tezaurs-2026-2";
const RULESET_VERSION = "lingo-2.0";
const LENGTHS = [4, 5, 6, 7];
const LV_LETTERS = /^[a-zāčēģīķļņšūž]+$/;

// Conservative, documented blocklist. The goal is to keep obviously
// inappropriate entries out of the target pool. If a word slips through,
// it can be reported and added here in the next dictionary release.
const BLOCKLIST = new Set([
  "dirsa",
  "kuce",
  "kuča",
  "mauka",
  "pimps",
  "pidar",
  "žīds",
]);

// Pool quality gates: a length is enabled only when every gate passes.
// The UI hides disabled lengths rather than failing at runtime.
const MIN_TARGETS = 400;
const MIN_FREQUENT = 100;
const MIN_GUESSES = 1000;

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
  const entry = zip
    .getEntries()
    .find((e) => e.entryName.endsWith(entryName));
  if (!entry) throw new Error(`Entry not found in ${zipPath}: ${entryName}`);
  return entry.getData().toString("utf8");
}

/** All lemma entries: decoded word, raw writtenForm and part of speech. */
function parseLmf(xml) {
  const entries = [];
  for (const match of xml.matchAll(
    /<LexicalEntry[^>]*>([\s\S]*?)<\/LexicalEntry>/g,
  )) {
    for (const lemma of match[1].matchAll(
      /<Lemma\s+writtenForm="([^"]*)"\s+partOfSpeech="([^"]*)"/g,
    )) {
      entries.push({
        raw: lemma[1],
        word: decodeXml(lemma[1]),
        pos: lemma[2],
      });
    }
  }
  return entries;
}

/** First occurrence wins, mirroring the frozen 5-letter behaviour. */
function parseFrequency(tsv) {
  const rows = new Map(); // lemma -> {pos, rank}
  let rank = 0;
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("Lemma")) continue;
    const [lemma, pos, freq] = line.split("\t");
    if (!lemma || !pos || !Number.isFinite(Number(freq))) continue;
    const key = lemma.toLowerCase();
    if (!rows.has(key)) rows.set(key, { pos, rank });
    rank++;
  }
  return rows;
}

function main() {
  const lmfXml = readZipEntry(
    path.join(SRC_DIR, "tezaurs-lmf.zip"),
    "tezaurs_2026_2_lmf.xml",
  );
  const ispellText = readZipEntry(
    path.join(SRC_DIR, "tezaurs-ispell.zip"),
    ".ispell",
  );
  const freqTsv = fs.readFileSync(
    path.join(SRC_DIR, "frequencies-lv-25K.tsv"),
    "utf8",
  );

  const entries = parseLmf(lmfXml);
  const freq = parseFrequency(freqTsv);
  const ispellRaw = ispellText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const manifestLengths = {};
  const pools = {};

  for (const length of LENGTHS) {
    const rawLemmas = entries.filter((e) => e.word.length === length);
    const uniqueRaw = new Set(rawLemmas.map((e) => e.word));
    const properNames = rawLemmas.filter(
      (e) =>
        !e.word.includes(" ") &&
        !e.word.includes("-") &&
        /^[A-ZĀČĒĢĪĶĻŅŠŪŽ]/.test(e.raw),
    ).length;
    const excludedByAlphabet = rawLemmas.filter(
      (e) => !LV_LETTERS.test(e.word),
    ).length;
    const excludedByFormat = rawLemmas.filter(
      (e) => e.word.includes(" ") || e.word.includes("-"),
    ).length;
    const blocklisted = [...uniqueRaw].filter((w) =>
      BLOCKLIST.has(w.normalize("NFC").toLowerCase()),
    ).length;

    const rawIspell = ispellRaw.filter((w) => w.length === length);

    const nouns = new Set(
      entries
        .filter((e) => e.pos === "n")
        .map((e) => e.word)
        .filter(
          (w) =>
            w.length === length &&
            !w.includes(" ") &&
            !w.includes("-") &&
            LV_LETTERS.test(w) &&
            !BLOCKLIST.has(w),
        ),
    );

    const frequentRanked = [...nouns]
      .filter((w) => freq.get(w)?.pos === "n")
      .sort((a, b) => (freq.get(a)?.rank ?? 0) - (freq.get(b)?.rank ?? 0));
    const frequent = frequentRanked.slice().sort();

    const targets = [...nouns].sort();

    const guesses = new Set(rawIspell.filter((w) => LV_LETTERS.test(w)));
    for (const e of entries) {
      const w = e.word;
      if (w.length === length && !w.includes(" ") && !w.includes("-")) {
        const normalized = w.normalize("NFC").toLowerCase();
        if (LV_LETTERS.test(normalized)) guesses.add(normalized);
      }
    }
    for (const t of targets) guesses.add(t);

    const enabled =
      targets.length >= MIN_TARGETS &&
      frequent.length >= MIN_FREQUENT &&
      guesses.size >= MIN_GUESSES;

    const stats = {
      rawLemmas: rawLemmas.length,
      rawIspell: rawIspell.length,
      properNames,
      excludedByAlphabet,
      excludedByFormat,
      excludedByBlocklist: blocklisted,
      duplicateLemmas: rawLemmas.length - uniqueRaw.size,
      targetCount: targets.length,
      frequentCount: frequent.length,
      guessCount: guesses.size,
      gates: { MIN_TARGETS, MIN_FREQUENT, MIN_GUESSES },
    };

    const file = `length-${length}.json`;
    manifestLengths[String(length)] = { enabled, file, ...stats };
    pools[length] = {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      length,
      targetCount: targets.length,
      frequentCount: frequent.length,
      guessCount: guesses.size,
      targets,
      frequent,
      guesses: [...guesses].sort(),
      license: "CC BY-SA 4.0",
      sources: sourcesMeta(),
    };
  }

  // Freeze the five-letter pools: the Daily puzzle depends on them.
  const legacyPath = path.join(OUT_DIR, "dictionary.json");
  const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  const legacyPool = pools[5];
  const sameSets =
    legacy.targets.length === legacyPool.targets.length &&
    legacy.targets.every((w, i) => w === legacyPool.targets[i]) &&
    legacy.frequent.length === legacyPool.frequent.length &&
    legacy.frequent.every((w, i) => w === legacyPool.frequent[i]) &&
    legacy.guesses.length === legacyPool.guesses.length &&
    legacy.guesses.every((w, i) => w === legacyPool.guesses[i]);
  if (!sameSets) {
    console.error(
      "targets:",
      legacy.targets.length,
      "vs",
      legacyPool.targets.length,
    );
    console.error(
      "frequent:",
      legacy.frequent.length,
      "vs",
      legacyPool.frequent.length,
    );
    console.error(
      "guesses:",
      legacy.guesses.length,
      "vs",
      legacyPool.guesses.length,
    );
    const legacyT = new Set(legacy.targets);
    const legacyF = new Set(legacy.frequent);
    const legacyG = new Set(legacy.guesses);
    console.error(
      "new targets not in legacy:",
      legacyPool.targets.filter((w) => !legacyT.has(w)).slice(0, 20),
    );
    console.error(
      "legacy targets not in new:",
      legacy.targets.filter((w) => !legacyPool.targets.includes(w)).slice(0, 20),
    );
    console.error(
      "new frequent not in legacy:",
      legacyPool.frequent.filter((w) => !legacyF.has(w)).slice(0, 20),
    );
    console.error(
      "legacy frequent not in new:",
      legacy.frequent.filter((w) => !legacyPool.frequent.includes(w)).slice(0, 20),
    );
    console.error(
      "new guesses not in legacy:",
      legacyPool.guesses.filter((w) => !legacyG.has(w)).slice(0, 20),
    );
    console.error(
      "legacy guesses not in new:",
      legacy.guesses.filter((w) => !legacyPool.guesses.includes(w)).slice(0, 20),
    );
    throw new Error(
      "Five-letter pools would change; refusing to regenerate. " +
        "Investigate the filtering rules before continuing.",
    );
  }

  fs.mkdirSync(LV_OUT_DIR, { recursive: true });
  for (const length of LENGTHS) {
    fs.writeFileSync(
      path.join(LV_OUT_DIR, `length-${length}.json`),
      JSON.stringify(pools[length]),
      "utf8",
    );
  }

  const manifest = {
    id: "lv",
    locale: "lv-LV",
    displayName: "Latviešu",
    dictionaryVersion: VERSION,
    ruleSetVersion: RULESET_VERSION,
    generatedAt: new Date().toISOString(),
    license: "CC BY-SA 4.0",
    attribution:
      "Vārdu dati atvasināti no Tēzaurs.lv 2026 atvērtajiem datiem " +
      "(CC BY-SA 4.0, handle 20.500.12574/156) un Latviešu valodas vārdu " +
      "biežuma datu kopas (CC BY-SA 4.0, handle 20.500.12574/148), " +
      "CLARIN-LV digitālā bibliotēka.",
    sources: sourcesMeta(),
    lengths: manifestLengths,
  };
  fs.writeFileSync(
    path.join(LV_OUT_DIR, "manifest.json"),
    JSON.stringify(manifest),
    "utf8",
  );

  // Legacy five-letter file keeps its committed shape.
  const legacyOut = { ...legacy, generatedAt: new Date().toISOString() };
  fs.writeFileSync(legacyPath, JSON.stringify(legacyOut), "utf8");

  fs.writeFileSync(
    path.join(ROOT, "data", "DICTIONARY_REPORT.md"),
    buildReport(manifest),
    "utf8",
  );

  for (const length of LENGTHS) {
    const s = manifestLengths[String(length)];
    console.log(
      `length ${length}: enabled=${s.enabled} targets=${s.targetCount} ` +
        `frequent=${s.frequentCount} guesses=${s.guessCount}`,
    );
  }
  const disabled = Object.values(manifestLengths).filter((s) => !s.enabled);
  if (disabled.length > 0) {
    console.error("WARNING: some lengths failed the quality gates");
  }
}

function sourcesMeta() {
  return [
    {
      name: "Tēzaurs.lv 2026 (Spring Edition) open data — Latvian WordNet (LMF/XML)",
      handle: "20.500.12574/156",
      license: "CC BY-SA 4.0",
    },
    {
      name: "Tēzaurs.lv 2026 open data — wordforms (ispell)",
      handle: "20.500.12574/156",
      license: "CC BY-SA 4.0",
    },
    {
      name: "Latvian word frequency dataset (25K)",
      handle: "20.500.12574/148",
      license: "CC BY-SA 4.0",
    },
  ];
}

function buildReport(manifest) {
  const rows = LENGTHS.map((l) => {
    const s = manifest.lengths[String(l)];
    return [
      l,
      s.enabled ? "jā" : "nē",
      s.rawLemmas,
      s.rawIspell,
      s.excludedByAlphabet,
      s.excludedByFormat,
      s.properNames,
      s.excludedByBlocklist,
      s.duplicateLemmas,
      s.targetCount,
      s.frequentCount,
      s.guessCount,
    ].join(" | ");
  });
  return [
    "# Latviešu valodas vārdnīcu pārskats (autoģenerēts)",
    "",
    `Versija: \`${VERSION}\` · ģenerēts: ${new Date().toISOString()}`,
    "",
    "## Atlases politika",
    "",
    "- Mērķvārdi: lietvārdu lemmas no WordNet (LMF), tikai latviešu alfabēta",
    "  mazie burti (NFC), bez atstarpēm/defisēm, bez lielā sākumburta",
    "  (īpašvārdi), ārpus aizskarošo vārdu saraksta.",
    "- Biežie mērķvārdi: mērķvārdi, kas ir 25K biežuma kopā ar POS `n`.",
    "- Minējumi: ispell vārdformas + visas LMF lemmas + mērķvārdi",
    "  (alfabēts, NFC, bez atstarpēm/defisēm).",
    "- Kvalitātes slieksnis: mērķvārdi ≥ 400, biežie ≥ 100, minējumi ≥ 1000.",
    "- 5 burtu kopas ir iesaldētas (Dienas vārda identitāte).",
    "",
    "## Statistika",
    "",
    "| garums | iespējots | neapstr. lemmas | neapstr. ispell | nederīgas rakstzīmes | formāts | īpašvārdi | bloķēti | dublikāti | mērķi | biežie | minējumi |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r} |`),
    "",
    "## Avoti un licences",
    "",
    "- Tēzaurs.lv 2026 atvērtie dati (WordNet LMF un ispell), CC BY-SA 4.0,",
    "  handle 20.500.12574/156.",
    "- Latviešu valodas vārdu biežuma datu kopa (25K), CC BY-SA 4.0,",
    "  handle 20.500.12574/148.",
    "",
    "Atvasinātie faili tiek izplatīti ar CC BY-SA 4.0.",
    "",
    "Reproducēšana: `npm run gen:dict` (avota faili `data-src/`).",
    "",
  ].join("\n");
}

main();
