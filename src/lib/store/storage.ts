const PREFIX = "lk.";
const memoryStore = new Map<string, string>();

export function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function storageGet<T>(key: string): T | null {
  if (!isBrowser()) {
    const raw = memoryStore.get(PREFIX + key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: unknown): void {
  if (!isBrowser()) {
    memoryStore.set(PREFIX + key, JSON.stringify(value));
    return;
  }
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; gameplay continues in-memory.
  }
}

export function storageRemove(key: string): void {
  if (!isBrowser()) {
    memoryStore.delete(PREFIX + key);
    return;
  }
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

export function guestId(): string {
  if (isBrowser()) {
    let id = window.localStorage.getItem("lk.guestId");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("lk.guestId", id);
    }
    return id;
  }
  return "server";
}

/** Remove all guest data (statistics, settings, sessions, identity). */
export function clearGuestData(): void {
  if (!isBrowser()) {
    memoryStore.clear();
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
}

// ---- Versioned game saves -------------------------------------------------
// Game sessions are wrapped in a schema-versioned envelope so malformed,
// legacy or partially written data can be detected and recovered without
// touching unrelated statistics or settings.

export interface GameSaveMeta {
  v: number;
  createdAt: string;
  updatedAt: string;
  status: string | null;
}

export interface GameSaveEnvelope<T> {
  v: number;
  createdAt: string;
  updatedAt: string;
  status: string | null;
  data: T;
}

export const GAME_SAVE_VERSION = 2;

function isEnvelope<T>(raw: unknown): raw is GameSaveEnvelope<T> {
  return (
    !!raw &&
    typeof raw === "object" &&
    "v" in raw &&
    "createdAt" in raw &&
    "updatedAt" in raw &&
    "data" in raw
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Load a versioned game save. Accepts legacy (V1.0/V1.1) unwrapped payloads
 * and migrates them implicitly. Returns null when the data is missing or
 * fails validation — the broken key is removed so it cannot trap the user.
 */
export function loadGame<T>(
  key: string,
  validate: (data: unknown) => data is T,
): { data: T; meta: GameSaveMeta } | null {
  const raw = storageGet<unknown>(key);
  if (raw === null || raw === undefined) return null;
  if (isEnvelope<T>(raw)) {
    if (raw.v > GAME_SAVE_VERSION) return null; // future schema — don't guess
    if (!validate(raw.data)) {
      storageRemove(key);
      return null;
    }
    return {
      data: raw.data,
      meta: {
        v: GAME_SAVE_VERSION,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        status: raw.status ?? null,
      },
    };
  }
  // Legacy unwrapped payload from V1.0/V1.1.
  if (!validate(raw)) {
    storageRemove(key);
    return null;
  }
  const now = nowIso();
  return { data: raw, meta: { v: 1, createdAt: now, updatedAt: now, status: null } };
}

export function saveGame<T>(
  key: string,
  data: T,
  status: string | null = null,
): void {
  const previous = storageGet<unknown>(key);
  const createdAt =
    previous && isEnvelope<T>(previous) ? previous.createdAt : nowIso();
  const envelope: GameSaveEnvelope<T> = {
    v: GAME_SAVE_VERSION,
    createdAt,
    updatedAt: nowIso(),
    status,
    data,
  };
  storageSet(key, envelope);
}

/** Read only the metadata of a save (for the saved-games settings panel). */
export function peekGameSave<T>(key: string): GameSaveMeta | null {
  const raw = storageGet<unknown>(key);
  if (raw === null || raw === undefined) return null;
  if (isEnvelope<T>(raw)) {
    return {
      v: raw.v,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      status: raw.status ?? null,
    };
  }
  return null;
}
