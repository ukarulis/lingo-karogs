import dictionaryData from "./data/dictionary.json";

export interface DictionaryData {
  version: string;
  generatedAt: string;
  targetCount: number;
  frequentCount: number;
  guessCount: number;
  targets: string[];
  frequent: string[];
  guesses: string[];
  license: string;
  sources: Array<{ name: string; handle: string; license: string }>;
}

export const dictionary = dictionaryData as unknown as DictionaryData;

export const guessSet: ReadonlySet<string> = new Set(dictionary.guesses);
export const targetList: readonly string[] = dictionary.targets;
export const frequentTargets: readonly string[] = dictionary.frequent;

/** Random target avoiding the recently used words. */
export function pickTarget(
  rng: () => number = Math.random,
  avoid: ReadonlySet<string> = new Set(),
): string {
  const pool =
    dictionary.targets.filter((w) => !avoid.has(w)) ??
    // Unreachable fallback keeps types happy; pool is never empty.
    [];
  if (pool.length === 0) {
    return dictionary.targets[Math.floor(rng() * dictionary.targets.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}

export function isGuess(word: string): boolean {
  return guessSet.has(word);
}
