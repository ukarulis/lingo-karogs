"use client";

import { memo } from "react";
import {
  type CellStatus,
} from "@/lib/lingo/engine";
import type { Palette } from "@/lib/lingo/colors";
import { statusStyle } from "@/lib/lingo/colors";
import { cn } from "@/lib/utils";

export interface BoardCell {
  letter: string | null;
  status: CellStatus | "empty";
  state: "idle" | "typed" | "revealed" | "hint" | "done";
}

export interface BoardRow {
  cells: BoardCell[];
  state: "done" | "current" | "empty";
  shake?: boolean;
}

export const LingoBoard = memo(function LingoBoard({
  rows,
  palette,
}: {
  rows: BoardRow[];
  palette: Palette;
}) {
  const columns = rows[0]?.cells.length ?? 5;
  const rowCount = rows.length;
  const compact = columns >= 6;
  const letterClass =
    columns <= 5
      ? "text-3xl"
      : columns === 6
        ? "text-2xl"
        : "text-xl sm:text-2xl";
  const containerClass =
    columns === 5
      ? "mx-auto w-full max-w-[320px] sm:max-w-[360px]"
      : "mx-auto w-full";
  const containerStyle =
    columns === 5
      ? undefined
      : { maxWidth: `${columns * 72 - 8}px` };
  return (
    <div
      role="group"
      aria-label="Spēles laukums"
      className={containerClass}
      style={containerStyle}
    >
      <div
        role="grid"
        className={cn("grid", compact ? "gap-1 sm:gap-1.5" : "gap-2")}
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {rows.map((row, r) => (
          <div
            key={r}
            role="row"
            className={cn(
              "grid",
              compact ? "gap-1 sm:gap-1.5" : "gap-2",
              row.shake && "animate-[shake_0.45s_ease-in-out]",
            )}
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {row.cells.map((cell, c) => {
              const style = statusStyle(cell.status, palette);
              return (
                <div
                  key={c}
                  role="gridcell"
                  aria-label={
                    cell.letter
                      ? `${cell.letter}${cell.status === "correct" ? " — pareizi" : cell.status === "present" ? " — citā vietā" : cell.status === "absent" ? " — nav vārdā" : ""}`
                      : "Tukšs lauciņš"
                  }
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl border-2 font-black uppercase transition-all",
                    letterClass,
                    cell.state === "done" && "animate-[flip_0.5s_ease-in-out]",
                    cell.state === "typed" &&
                      "border-stone-400 bg-white dark:border-stone-400 dark:bg-stone-800",
                    cell.state === "hint" &&
                      "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200",
                    cell.status === "empty" &&
                      cell.state !== "hint" &&
                      cell.state !== "typed" &&
                      "border-stone-300 dark:border-stone-600",
                  )}
                  style={
                    (cell.state === "hint" || cell.status === "empty")
                      ? cell.state === "done"
                        ? { animationDelay: `${c * 55}ms` }
                        : undefined
                      : {
                          backgroundColor: style.backgroundColor,
                          color: style.color,
                          borderColor: style.borderColor,
                          ...(cell.state === "done" ? { animationDelay: `${c * 55}ms` } : {}),
                        }
                  }
                >
                  {cell.letter ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes flip { 0% { transform: rotateX(0); } 45% { transform: rotateX(90deg); } 55% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
      `}</style>
    </div>
  );
});
