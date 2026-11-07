// Reproducible dictionary generation for Lingo.
//
// Sources (all CC BY-SA 4.0, see data/NOTICE.md):
//  - Tezaurs.lv 2026 (Spring) open data - Latvian WordNet in LMF/XML
//    https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156
//  - Tezaurs.lv 2026 wordforms (ispell newline list), same item
//  - Latvian word frequency dataset (25K), CLARIN-LV
//    https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148
//
// Output: src/lib/lingo/data/dictionary.json
//   targets  - 5-letter common-noun lemmas suitable as hidden words
//   frequent - targets that appear in the 25K frequency list (used for daily word)
//   guesses  - every accepted 5-letter guess (targets are always included)

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data-src");
const OUT_DIR = path.join(ROOT, "src", "lib", "lingo", "data");

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

function parseLmf(xml) {
  // <LexicalEntry ...> <Lemma writtenForm="..." partOfSpeech="n"/> ... </LexicalEntry>
  const entries = xml.matchAll(
    /<LexicalEntry[^>]*>([\s\S]*?)<\/LexicalEntry>/g,
  );
  const byPos = new Map();
  for (const match of entries) {
    const body = match[1];
    const lemmas = body.matchAll(
      /<Lemma\s+writtenForm="([^"]*)"\s+partOfSpeech="([^"]*)"/g,
    );
    for (const lemma of lemmas) {
      const word = decodeXml(lemma[1]);
      const pos = lemma[2];
      if (!byPos.has(pos)) byPos.set(pos, new Set());
      byPos.get(pos).add(word);
    }
  }
  return byPos;
}

function parseFrequency(tsv) {
  // Lemma, POS1, perMille
  const rows = new Map(); // lemma -> {pos, rank}
  let rank = 0;
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("Lemma")) continue;
    const [lemma, pos, freq] = line.split("\t");
    if (!lemma || !pos || freq === undefined) continue;
    if (!Number.isFinite(Number(freq))) continue;
    const key = lemma.toLowerCase();
    if (!rows.has(key)) rows.set(key, { pos, rank, freq: Number(freq) });
    rank++;
  }
  return rows;
}

function parseIspell(text) {
  const words = new Set();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim();
    if (w && w.length === 5 && LV_LETTERS.test(w)) words.add(w);
  }
  return words;
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

  const byPos = parseLmf(lmfXml);
  const freq = parseFrequency(freqTsv);
  const ispellWords = parseIspell(ispellText);

  const isWord = (w) =>
    typeof w === "string" &&
    w.length === 5 &&
    LV_LETTERS.test(w) &&
    !BLOCKLIST.has(w);

  const nouns = [...(byPos.get("n") ?? new Set())]
    .filter((w) => !w.includes(" ") && !w.includes("-"))
    .filter(isWord);

  const frequent = nouns
    .filter((w) => freq.get(w)?.pos === "n")
    .sort((a, b) => (freq.get(a)?.rank ?? 0) - (freq.get(b)?.rank ?? 0));

  const targets = [...new Set([...frequent, ...nouns.sort()])];

  const guesses = new Set(ispellWords);
  for (const posSet of byPos.values()) {
    for (const w of posSet) {
      if (!w.includes(" ") && !w.includes("-") && w.length === 5) {
        const normalized = w.normalize("NFC").toLowerCase();
        if (LV_LETTERS.test(normalized)) guesses.add(normalized);
      }
    }
  }
  for (const t of targets) guesses.add(t);

  const allFrequent = frequent.length >= 300 ? frequent : targets;

  const out = {
    version: "tezaurs-2026-2",
    generatedAt: new Date().toISOString(),
    targetCount: targets.length,
    frequentCount: allFrequent.length,
    guessCount: guesses.size,
    targets: targets.sort(),
    frequent: allFrequent.slice().sort(),
    guesses: [...guesses].sort(),
    license: "CC BY-SA 4.0",
    sources: [
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
    ],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "dictionary.json"),
    JSON.stringify(out),
    "utf8",
  );

  console.log(`targets: ${out.targetCount}`);
  console.log(`frequent targets (daily pool): ${out.frequentCount}`);
  console.log(`guesses: ${out.guessCount}`);
  console.log("sample targets:", out.targets.slice(0, 40).join(" "));
  if (out.targetCount < 800) {
    console.error("WARNING: fewer than 800 targets generated");
    process.exitCode = 1;
  }
}

main();
