// Lingo multiplayer storage backend selection. Server-side only.
// Scoped separately from the Karogs MULTIPLAYER_STORE switch so enabling
// Lingo multiplayer can never accidentally activate Karogs online play.

import type { LingoMpStore } from "./store";
import { SqliteLingoMpStore } from "./store-sqlite";
import { SupabaseLingoMpStore } from "./store-supabase";

export type LingoMpStoreMode = "sqlite" | "supabase" | "disabled";

export function lingoMpStoreMode(): LingoMpStoreMode {
  const explicit = process.env.LINGO_MP_STORE;
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "supabase") return "supabase";
  if (explicit === "disabled") return "disabled";
  // Production must opt in explicitly; local development uses SQLite.
  if (process.env.NODE_ENV === "production") return "disabled";
  return "sqlite";
}

let cached: LingoMpStore | null = null;
let cachedMode: LingoMpStoreMode | null = null;

export function getLingoMpStore(): LingoMpStore | null {
  const mode = lingoMpStoreMode();
  if (cached && cachedMode === mode) return cached;
  if (mode === "disabled") return null;
  if (mode === "sqlite") {
    cached = new SqliteLingoMpStore();
    cachedMode = mode;
    return cached;
  }
  try {
    cached = new SupabaseLingoMpStore();
    cachedMode = mode;
    return cached;
  } catch {
    return null;
  }
}
