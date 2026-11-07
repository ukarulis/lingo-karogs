"use client";

import { memo } from "react";
import { Delete, CornerDownLeft } from "lucide-react";
import type { CellStatus } from "@/lib/lingo/engine";
import type { Palette } from "@/lib/lingo/colors";
import { statusStyle } from "@/lib/lingo/colors";
import { cn } from "@/lib/utils";

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ē", "ī"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ā", "š", "ļ"],
  ["enter", "ņ", "ž", "č", "z", "c", "v", "b", "n", "m", "ģ", "ķ", "back"],
];

export const Keyboard = memo(function Keyboard({
  evidence,
  palette,
  onKey,
  disabled,
}: {
  evidence: Record<string, CellStatus>;
  palette: Palette;
  onKey: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-1.5">
      {ROWS.map((row, r) => (
        <div key={r} className="flex w-full justify-center gap-1 sm:gap-1.5">
          {row.map((key) => {
            if (key === "enter" || key === "back") {
              const Icon = key === "enter" ? CornerDownLeft : Delete;
              return (
                <button
                  key={key}
                  disabled={disabled}
                  onClick={() => onKey(key)}
                  aria-label={key === "enter" ? "Apstiprināt" : "Dzēst burtu"}
                  className="flex h-12 flex-1 basis-10 items-center justify-center rounded-lg bg-stone-300 text-stone-800 transition active:scale-95 disabled:opacity-40 dark:bg-stone-700 dark:text-stone-200 sm:h-13"
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              );
            }
            const status = evidence[key];
            const style = status ? statusStyle(status, palette) : null;
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => onKey(key)}
                aria-label={`Burts ${key}${status === "correct" ? ", pareizā vietā" : status === "present" ? ", citā vietā" : status === "absent" ? ", nav vārdā" : ""}`}
                className={cn(
                  "h-12 flex-1 rounded-lg text-[13px] font-bold uppercase transition active:scale-95 disabled:opacity-40 sm:text-base",
                  !style &&
                    "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200",
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
