// Storage backend selection. Server-side only.

import type { MpStore } from "./store";
import { SqliteMpStore } from "./store-sqlite";
import { SupabaseMpStore } from "./store-supabase";

export type StoreMode = "sqlite" | "supabase" | "disabled";

export function storeMode(): StoreMode {
  const explicit = process.env.MULTIPLAYER_STORE;
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "supabase") return "supabase";
  if (explicit === "disabled") return "disabled";
  if (process.env.NODE_ENV === "production") return "disabled";
  return "sqlite";
}

let cached: MpStore | null = null;
let cachedMode: StoreMode | null = null;

export function getStore(): MpStore | null {
  const mode = storeMode();
  if (cached && cachedMode === mode) return cached;
  if (mode === "disabled") return null;
  if (mode === "sqlite") {
    cached = new SqliteMpStore();
    cachedMode = mode;
    return cached;
  }
  try {
    cached = new SupabaseMpStore();
    cachedMode = mode;
    return cached;
  } catch {
    return null;
  }
}
