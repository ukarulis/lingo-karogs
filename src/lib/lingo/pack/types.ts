// Language-pack contract. A pack is plain, framework-free data plus pure
// functions; it can be used from the web, a server runtime or unit tests.

export type KeyboardKey = "enter" | "back";

export interface KeyboardLayout {
  /** On-screen keyboard rows; "enter"/"back" are reserved control keys. */
  rows: readonly (readonly (string | KeyboardKey)[])[];
  /** Keys that render smaller on narrow screens (diacritics, digraphs). */
  compactKeys?: readonly string[];
  /** Optional mapping from a physical key to the produced letter. */
  physicalKeyMap?: Readonly<Record<string, string>>;
}

export interface LanguagePack {
  /** Stable pack identifier, e.g. "lv". */
  id: string;
  /** Locale for display/collation, e.g. "lv-LV". */
  locale: string;
  /** Human-readable language name. */
  displayName: string;
  /** Version of the dictionary backing this pack. */
  dictionaryVersion: string;
  /** Version of the rule set this pack plays under. */
  ruleSetVersion: string;
  /** Word lengths the engine supports for this pack. */
  supportedLengths: readonly number[];
  /** Lowercase letters of the writing system (grapheme-level). */
  alphabet: readonly string[];
  /** Normalize raw input: trim, case, Unicode normalization. */
  normalizeInput(input: string): string;
  /** Split a normalized word into user-perceived letters. */
  segmentWord(word: string): string[];
  /** Whether every segment of a word belongs to the alphabet. */
  validateCharacters(word: string): boolean;
  keyboardLayout: KeyboardLayout;
  /** Attribution required by the data license. */
  attribution: string;
  license: string;
}
