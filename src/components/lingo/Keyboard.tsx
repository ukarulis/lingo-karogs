"use client";

import { memo } from "react";
import { Delete, CornerDownLeft } from "lucide-react";
import type { CellStatus } from "@/lib/lingo/engine";
import type { KeyboardLayout } from "@/lib/lingo/pack/types";
import { LATVIAN_KEYBOARD_ROWS } from "@/lib/lingo/pack/latvian";
import type { Palette } from "@/lib/lingo/colors";
import { statusStyle } from "@/lib/lingo/colors";
import { cn } from "@/lib/utils";

export const Keyboard = memo(function Keyboard({
  evidence,
  palette,
  onKey,
  disabled,
  layout,
}: {
  evidence: Record<string, CellStatus>;
  palette: Palette;
  onKey: (key: string) => void;
  disabled?: boolean;
  layout?: KeyboardLayout;
}) {
  const rows = layout?.rows ?? LATVIAN_KEYBOARD_ROWS;
  const compactKeys = new Set(layout?.compactKeys ?? []);
  const rowClass = (row: readonly (string | "enter" | "back")[]) => {
    const hasAction = row.some((k) => k === "enter" || k === "back");
    if (hasAction && row.length === 8) {
      return "grid-cols-[1.5fr_repeat(6,1fr)_1.5fr]";
    }
    if (row.length === 11) return "grid-cols-11";
    return "grid-flow-col auto-cols-fr";
  };
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1.5">
      {rows.map((row, r) => (
        <div
          key={r}
          className={cn(
            "grid w-full gap-1 sm:gap-1.5",
            rowClass(row),
          )}
        >
          {row.map((key) => {
            if (key === "enter" || key === "back") {
              const Icon = key === "enter" ? CornerDownLeft : Delete;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onKey(key)}
                  aria-label={key === "enter" ? "Apstiprināt" : "Dzēst burtu"}
                  className={cn(
                    "flex h-12 items-center justify-center gap-1 rounded-lg text-sm font-bold transition active:scale-95 disabled:opacity-40 sm:h-13",
                    key === "enter"
                      ? "bg-indigo-600 text-white hover:bg-indigo-500"
                      : "bg-stone-300 text-stone-800 hover:bg-stone-400 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="hidden sm:inline">{key === "enter" ? "Ievadīt" : "Dzēst"}</span>
                </button>
              );
            }
            const status = evidence[key];
            const style = status ? statusStyle(status, palette) : null;
            const compact = compactKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onKey(key)}
                aria-label={`Burts ${key}${status === "correct" ? ", pareizā vietā" : status === "present" ? ", citā vietā" : status === "absent" ? ", nav vārdā" : ""}`}
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg text-sm font-bold uppercase transition active:scale-95 disabled:opacity-40 sm:h-13 sm:text-base",
                  compact && "text-[13px] sm:text-sm",
                  !style && "bg-stone-200 text-stone-800 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
                )}
                style={
                  style
                    ? { backgroundColor: style.backgroundColor, color: style.color }
                    : undefined
                }
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
