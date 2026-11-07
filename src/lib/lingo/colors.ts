// Tile and key colors for the selectable palettes.

import type { CellStatus } from "./engine";

export interface Palette {
  correct: string;
  correctText: string;
  present: string;
  presentText: string;
  absent: string;
  absentText: string;
  empty: string;
  emptyBorder: string;
}

export type PaletteId = "modern" | "legacy" | "contrast";

export const PALETTES: Record<PaletteId, { light: Palette; dark: Palette }> = {
  modern: {
    light: {
      correct: "#16a34a",
      correctText: "#ffffff",
      present: "#d97706",
      presentText: "#ffffff",
      absent: "#dc2626",
      absentText: "#ffffff",
      empty: "#ffffff",
      emptyBorder: "#d6d3d1",
    },
    dark: {
      correct: "#16a34a",
      correctText: "#ffffff",
      present: "#f59e0b",
      presentText: "#1c1917",
      absent: "#dc2626",
      absentText: "#ffffff",
      empty: "#1c1b18",
      emptyBorder: "#44403c",
    },
  },
  // Historical/2013 presentation: correct = red, absent = green.
  legacy: {
    light: {
      correct: "#dc2626",
      correctText: "#ffffff",
      present: "#d97706",
      presentText: "#ffffff",
      absent: "#16a34a",
      absentText: "#ffffff",
      empty: "#ffffff",
      emptyBorder: "#d6d3d1",
    },
    dark: {
      correct: "#ef4444",
      correctText: "#ffffff",
      present: "#f59e0b",
      presentText: "#1c1917",
      absent: "#15803d",
      absentText: "#ffffff",
      empty: "#1c1b18",
      emptyBorder: "#44403c",
    },
  },
  // High-contrast / color-vision-friendly palette.
  contrast: {
    light: {
      correct: "#0057b8",
      correctText: "#ffffff",
      present: "#c2410c",
      presentText: "#ffffff",
      absent: "#525252",
      absentText: "#ffffff",
      empty: "#ffffff",
      emptyBorder: "#404040",
    },
    dark: {
      correct: "#3b82f6",
      correctText: "#0b1220",
      present: "#fb923c",
      presentText: "#1c1007",
      absent: "#737373",
      absentText: "#ffffff",
      empty: "#1c1b18",
      emptyBorder: "#737373",
    },
  },
};

export function paletteFor(
  id: PaletteId,
  dark: boolean,
  highContrast: boolean,
): Palette {
  const resolved = highContrast ? "contrast" : id;
  return PALETTES[resolved][dark ? "dark" : "light"];
}

export function statusStyle(
  status: CellStatus | "empty",
  palette: Palette,
): { backgroundColor: string; color: string; borderColor: string } {
  if (status === "empty") {
    return {
      backgroundColor: palette.empty,
      color: "inherit",
      borderColor: palette.emptyBorder,
    };
  }
  const map: Record<CellStatus, keyof Palette> = {
    correct: "correct",
    present: "present",
    absent: "absent",
  };
  const key = map[status];
  const textKey = `${key}Text` as keyof Palette;
  return {
    backgroundColor: palette[key] as string,
    color: palette[textKey] as string,
    borderColor: palette[key] as string,
  };
}
