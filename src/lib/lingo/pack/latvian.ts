import type { LanguagePack } from "./types";

export const LATVIAN_ALPHABET = [
  "a", "ā", "b", "c", "č", "d", "e", "ē", "f", "g", "ģ",
  "h", "i", "ī", "j", "k", "ķ", "l", "ļ", "m", "n", "ņ",
  "o", "p", "r", "s", "š", "t", "u", "ū", "v", "z", "ž",
] as const;

const ALPHABET_SET: ReadonlySet<string> = new Set(LATVIAN_ALPHABET);

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("lv", { granularity: "grapheme" })
    : null;

/** Split into user-perceived letters (grapheme clusters). */
export function segmentWord(word: string): string[] {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(word)].map((s) => s.segment);
  }
  return [...word];
}

// Diacritics get their own row so letter keys never shrink below a usable
// size on narrow phones; the full Latvian alphabet stays accessible.
export const LATVIAN_KEYBOARD_ROWS = [
  ["ā", "ē", "ī", "ū", "ķ", "ļ", "ņ", "ģ", "š", "ž", "č"],
  ["e", "r", "t", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "c", "v", "b", "n", "m", "back"],
] as const;

export const LATVIAN_DIACRITICS: ReadonlySet<string> = new Set([
  "ā", "ē", "ī", "ū", "ķ", "ļ", "ņ", "ģ", "š", "ž", "č",
]);

export const latvianPack: LanguagePack = {
  id: "lv",
  locale: "lv-LV",
  displayName: "Latviešu",
  dictionaryVersion: "tezaurs-2026-2",
  ruleSetVersion: "lingo-2.0",
  supportedLengths: [4, 5, 6, 7],
  alphabet: LATVIAN_ALPHABET,
  normalizeInput: (input) => input.trim().normalize("NFC").toLowerCase(),
  segmentWord,
  validateCharacters: (word) =>
    segmentWord(word).every((grapheme) => ALPHABET_SET.has(grapheme)),
  keyboardLayout: {
    rows: LATVIAN_KEYBOARD_ROWS,
    compactKeys: [...LATVIAN_DIACRITICS],
  },
  attribution:
    "Vārdu dati atvasināti no Tēzaurs.lv 2026 atvērtajiem datiem " +
    "(CC BY-SA 4.0, handle 20.500.12574/156) un Latviešu valodas vārdu " +
    "biežuma datu kopas (CC BY-SA 4.0, handle 20.500.12574/148), " +
    "CLARIN-LV digitālā bibliotēka.",
  license: "CC BY-SA 4.0",
};
