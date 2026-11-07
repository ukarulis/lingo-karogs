// Lingo multiplayer storage backend selection. Server-side only.
// Scoped separately from the Karogs MULTIPLAYER_STORE switch so enabling
// Lingo multiplayer can never accidentally activate Karogs online play.

import type { LingoMpStore } from "./store";
import { SqliteLingoMpStore } from "./store-sqlite";
import { SupabaseLingoMpStore } from "./store-supabase";
import { PostgresLingoMpStore } from "./store-postgres";
import { rateLimit as inMemoryRateLimit } from "@/lib/multiplayer/rate-limit";

export type LingoMpStoreMode = "sqlite" | "supabase" | "postgres" | "disabled";

export function lingoMpStoreMode(): LingoMpStoreMode {
  const explicit = process.env.LINGO_MP_STORE;
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "supabase") return "supabase";
  if (explicit === "postgres") return "postgres";
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
  if (mode === "postgres") {
    try {
      cached = new PostgresLingoMpStore();
      cachedMode = mode;
      return cached;
    } catch {
      console.error(
        JSON.stringify({
          scope: "lingo-mp",
          event: "store-unavailable",
          mode: "postgres",
          reason: "missing LINGO_MP_DATABASE_URL or pool error",
        }),
      );
      return null;
    }
  }
  try {
    cached = new SupabaseLingoMpStore();
    cachedMode = mode;
    return cached;
  } catch {
    return null;
  }
}

/** Idempotently construct the store and apply pending migrations. */
export async function ensureLingoMpStore(): Promise<LingoMpStore | null> {
  const store = getLingoMpStore();
  if (!store) return null;
  try {
    await store.migrate();
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "lingo-mp",
        event: "migration-failed",
        error: (error as Error).message?.slice(0, 160),
      }),
    );
    return null;
  }
  return store;
}

/**
 * Rate limiting shared across instances when the backend supports it;
 * falls back to the in-memory limiter otherwise.
 */
export async function lingoRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const store = getLingoMpStore();
  if (store) {
    try {
      return await store.rateLimit(key, limit, windowSec);
    } catch {
      // Fall through to the local limiter on backend failure.
    }
  }
  return inMemoryRateLimit(key, limit, windowSec * 1000);
}
