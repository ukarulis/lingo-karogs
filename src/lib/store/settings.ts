import { isBrowser, storageGet, storageSet } from "./storage";

export type Theme = "light" | "dark" | "system";
export type PaletteId = "modern" | "legacy";

export interface Settings {
  theme: Theme;
  palette: PaletteId;
  highContrast: boolean;
  sound: boolean;
  reducedMotion: boolean;
  nickname: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  palette: "modern",
  highContrast: false,
  sound: true,
  reducedMotion: false,
  nickname: "",
};

type Listener = () => void;
const listeners = new Set<Listener>();

let cached: Settings | null = null;

export function loadSettings(): Settings {
  if (!cached) {
    cached = {
      ...DEFAULT_SETTINGS,
      ...(storageGet<Partial<Settings>>("settings") ?? {}),
    };
  }
  return cached;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cached = { ...loadSettings(), ...patch };
  storageSet("settings", cached);
  emit();
  return cached;
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

export function effectiveTheme(): "light" | "dark" {
  const theme = loadSettings().theme;
  if (theme !== "system") return theme;
  if (isBrowser() && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyThemeToDocument(): void {
  if (!isBrowser()) return;
  const dark = effectiveTheme() === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("wa-dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
