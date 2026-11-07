// Word-discovery content access. All content is lazy-loaded static data;
// enrichment never blocks gameplay and failures fall back to null.

export type WordDifficulty = "beginner" | "standard" | "challenging";

export interface WordSense {
  definition: string[];
  example: { text: string; source: string | null } | null;
  pos: string;
  source: "tezaurs" | "editorial";
  editorial?: boolean;
}

export interface WordInfo {
  word: string;
  senses: WordSense[];
  difficulty: WordDifficulty;
}

export interface ContentManifest {
  version: string;
  language: string;
  dictionaryVersion: string;
  license: string;
  sources: Array<{
    name: string;
    handle: string;
    license: string;
    link: string;
  }>;
  difficulty: Record<string, string>;
  stats: { total: number; covered: number; senses: number; examples: number };
  editorial: { reviewedBy: string; overriddenWords: number };
  shards: Array<{ file: string; words: number }>;
}

type ShardData = {
  version: string;
  words: Record<string, { senses: WordSense[]; difficulty: WordDifficulty }>;
};

const shardCache = new Map<string, ShardData>();

async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function loadContentManifest(): Promise<ContentManifest | null> {
  return fetchJson<ContentManifest>("/content/lv/manifest.json");
}

/**
 * Load enrichment for one word. Returns null when content is missing or the
 * network fails — callers must never block gameplay on this.
 */
export async function loadWordInfo(word: string): Promise<WordInfo | null> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return null;
  const initial = normalized[0];
  let shard: ShardData | null = shardCache.get(initial) ?? null;
  if (!shard) {
    shard = await fetchJson<ShardData>(
      `/content/lv/${encodeURIComponent(initial)}.json`,
    );
    if (!shard) return null;
    shardCache.set(initial, shard);
  }
  const entry = shard.words[normalized];
  if (!entry) return null;
  return { word: normalized, senses: entry.senses, difficulty: entry.difficulty };
}

/** Beginner-friendly target subset (from the curated frequency tiers). */
export async function loadBeginnerWords(): Promise<Set<string> | null> {
  const data = await fetchJson<{ words: string[] }>("/content/lv/beginner.json");
  return data ? new Set(data.words) : null;
}

export const TEZAURS_SEARCH_URL = "https://tezaurs.lv/#/sv/";
