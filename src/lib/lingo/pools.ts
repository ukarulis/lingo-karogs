// Word-pool access for the Latvian language pack.
//
// The five-letter pool ships in the initial bundle (it also backs the legacy
// `dictionary.json` used by the Daily and Classic modes); the 4-, 6- and
// 7-letter pools are lazy-loaded per length so the initial bundle stays the
// same size as before multi-length support existed.

import manifest from "./data/lv/manifest.json";

export interface WordPool {
  version: string;
  generatedAt: string;
  length: number;
  targetCount: number;
  frequentCount: number;
  guessCount: number;
  targets: readonly string[];
  frequent: readonly string[];
  guesses: readonly string[];
  license: string;
  sources: readonly {
    name: string;
    handle: string;
    license: string;
  }[];
}

export interface DictionaryManifestLength {
  enabled: boolean;
  file: string;
  targetCount: number;
  frequentCount: number;
  guessCount: number;
  stats: Record<string, number | Record<string, number>>;
}

export interface DictionaryManifest {
  id: string;
  locale: string;
  displayName: string;
  dictionaryVersion: string;
  ruleSetVersion: string;
  generatedAt: string;
  license: string;
  attribution: string;
  sources: WordPool["sources"];
  lengths: Record<string, DictionaryManifestLength>;
}

export const dictionaryManifest = manifest as unknown as DictionaryManifest;

export function enabledLengths(): number[] {
  return Object.entries(dictionaryManifest.lengths)
    .map(([len, entry]) => ({ len: Number(len), entry }))
    .filter(({ entry }) => entry.enabled)
    .map(({ len }) => len)
    .sort((a, b) => a - b);
}

export function isLengthEnabled(length: number): boolean {
  return dictionaryManifest.lengths[String(length)]?.enabled === true;
}

type PoolModule = Omit<WordPool, "length">;

const LOADERS: Record<number, () => Promise<PoolModule>> = {
  4: () => import("./data/lv/length-4.json"),
  5: () => import("./data/dictionary.json"),
  6: () => import("./data/lv/length-6.json"),
  7: () => import("./data/lv/length-7.json"),
};

const poolCache = new Map<number, WordPool>();
const guessSetCache = new Map<number, ReadonlySet<string>>();

export async function loadPool(length: number): Promise<WordPool | null> {
  if (!isLengthEnabled(length)) return null;
  const cached = poolCache.get(length);
  if (cached) return cached;
  const loader = LOADERS[length];
  if (!loader) return null;
  const mod = (await loader()) as PoolModule;
  const pool: WordPool = { ...mod, length };
  if (
    !pool.targets ||
    pool.targets.length === 0 ||
    !pool.frequent ||
    pool.frequent.length === 0 ||
    !pool.guesses ||
    pool.guesses.length === 0
  ) {
    // Pool exists but is empty/corrupted: treat the length as disabled
    // instead of handing the UI an unplayable game.
    return null;
  }
  poolCache.set(length, pool);
  return pool;
}

export function getCachedPool(length: number): WordPool | null {
  return poolCache.get(length) ?? null;
}

export async function getGuessSet(
  length: number,
): Promise<ReadonlySet<string> | null> {
  const cached = guessSetCache.get(length);
  if (cached) return cached;
  const pool = await loadPool(length);
  if (!pool) return null;
  const set: ReadonlySet<string> = new Set(pool.guesses);
  guessSetCache.set(length, set);
  return set;
}

/** Random target avoiding recently used words. */
export function pickTargetFrom(
  pool: WordPool,
  rng: () => number = Math.random,
  avoid: ReadonlySet<string> = new Set(),
): string {
  const candidates =
    pool.targets.filter((w) => !avoid.has(w)).length > 0
      ? pool.targets.filter((w) => !avoid.has(w))
      : pool.targets;
  return candidates[Math.floor(rng() * candidates.length)] ?? pool.targets[0];
}
