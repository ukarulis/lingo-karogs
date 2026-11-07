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
