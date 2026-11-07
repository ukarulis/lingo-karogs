"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useState } from "react";
import {
  type Settings,
  applyThemeToDocument,
  loadSettings,
  subscribeSettings,
  updateSettings,
} from "./store/settings";

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, loadSettings, loadSettings);

  useEffect(() => {
    applyThemeToDocument();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  return [settings, updateSettings];
}

export function useDark(): boolean {
  const [settings] = useSettings();
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const calc = () =>
      setDark(
        settings.theme === "dark" ||
          (settings.theme === "system" && mq.matches),
      );
    calc();
    mq.addEventListener("change", calc);
    return () => mq.removeEventListener("change", calc);
  }, [settings.theme]);
  return dark;
}
