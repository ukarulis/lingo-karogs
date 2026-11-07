"use client";

import { memo, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { Cell, Side } from "@/lib/karogs/engine";
import { BOARD_SIZE, LAKE_CELLS } from "@/lib/karogs/engine";
import { cn } from "@/lib/utils";
import { PieceIcon, pieceAriaLabel } from "./PieceIcon";

const COL_LETTERS = "ABCDEFGHIJ";

function ColumnStrip() {
  return (
    <div
      aria-hidden
      className="mb-1 grid grid-cols-10 px-[7px] text-center text-[9px] font-bold text-stone-500 dark:text-stone-500"
    >
      {Array.from(COL_LETTERS, (letter) => (
        <span key={letter}>{letter}</span>
      ))}
    </div>
  );
}

export const KarogsBoard = memo(function KarogsBoard({
  cells,
  selected,
  destinations,
  lastMove,
  onCellClick,
  onCellHover,
  onCellDrop,
  disabled,
  zoom,
  onZoom,
  boardLabel,
}: {
  cells: Cell[];
  viewer: Side;
  selected: number | null;
  destinations: number[];
  lastMove: { from: number; to: number } | null;
  onCellClick: (idx: number) => void;
  onCellHover?: (idx: number | null) => void;
  onCellDrop?: (idx: number) => void;
  disabled?: boolean;
  zoom?: boolean;
  onZoom?: () => void;
  boardLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cellFromPoint = (clientX: number, clientY: number): number | null => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cell = Math.min(
      BOARD_SIZE - 1,
      Math.max(0, Math.floor((clientX - rect.left) / (rect.width / BOARD_SIZE))),
    );
    const row = Math.min(
      BOARD_SIZE - 1,
      Math.max(0, Math.floor((clientY - rect.top) / (rect.height / BOARD_SIZE))),
    );
    return row * BOARD_SIZE + cell;
  };

  return (
    <div className="mx-auto w-full max-w-[min(92vw,560px)]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400">{boardLabel}</span>
        {onZoom ? (
          <button
            onClick={onZoom}
            className="inline-flex items-center gap-1 rounded-md bg-stone-200 px-2 py-1 text-xs font-bold text-stone-700 transition hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200"
            aria-label={zoom ? "Samazināt laukumu" : "Palielināt laukumu"}
          >
            {zoom ? <ZoomOut className="size-3.5" aria-hidden /> : <ZoomIn className="size-3.5" aria-hidden />}
            {zoom ? "Samazināt" : "Palielināt"}
          </button>
        ) : null}
      </div>
      <ColumnStrip />
      <div className={cn("overflow-x-auto rounded-2xl", zoom && "overflow-y-auto")}>
        <div
          ref={ref}
          role="grid"
          aria-label={boardLabel}
          className={cn(
            "flex aspect-square select-none flex-col gap-[2px] rounded-xl border-2 border-stone-500/80 bg-stone-400 p-[3px] shadow-[inset_0_0_0_2px_rgba(120,113,108,0.25),0_8px_24px_-12px_rgba(28,25,23,0.35)] dark:border-stone-700 dark:bg-stone-950",
            zoom ? "min-w-[520px]" : "w-full",
          )}
          onPointerLeave={() => onCellHover?.(null)}
        >
          {Array.from({ length: BOARD_SIZE }, (_, y) => (
            <div key={y} role="row" className="grid min-h-0 flex-1 grid-cols-10 gap-[2px]">
              {Array.from({ length: BOARD_SIZE }, (_, x) => {
                const i = y * BOARD_SIZE + x;
                const piece = cells[i];
                const lake = LAKE_CELLS.has(i);
                const isSelected = selected === i;
                const isDest = destinations.includes(i);
                const isLast = lastMove && (lastMove.from === i || lastMove.to === i);
                return (
                  <button
                    key={i}
                    role="gridcell"
                    aria-label={`${COL_LETTERS[x]}${BOARD_SIZE - y}: ${pieceAriaLabel(piece)}${isDest ? ", iespējamais gājiens" : ""}`}
                    disabled={disabled && !lake}
                    onClick={() => onCellClick(i)}
                    onPointerMove={(e) => {
                      if (e.buttons === 1 && onCellHover) {
                        const idx = cellFromPoint(e.clientX, e.clientY);
                        if (idx !== null) onCellHover(idx);
                      }
                    }}
                    onPointerUp={(e) => {
                      if (onCellDrop) {
                        const idx = cellFromPoint(e.clientX, e.clientY);
                        if (idx !== null) onCellDrop(idx);
                      }
                    }}
                    className={cn(
                      "relative grid place-items-center rounded-[3px] transition-colors duration-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500",
                      lake
                        ? "bg-gradient-to-br from-sky-300/90 to-sky-500/80 dark:from-sky-800 dark:to-sky-950"
                        : "bg-[#f4eedd] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-stone-800 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                      !lake && !disabled && "hover:bg-[#efe6cc] dark:hover:bg-stone-700",
                      isSelected && "z-10 ring-2 ring-indigo-500 ring-offset-1 ring-offset-stone-400 dark:ring-indigo-400 dark:ring-offset-stone-950",
                  isLast && !isSelected && "animate-[pop_0.3s_ease-out] bg-amber-200 dark:bg-amber-900/60",
                      disabled && !lake && "opacity-90",
                    )}
                  >
                    {lake ? (
                      <span className="absolute inset-0 grid place-items-center" aria-hidden>
                        <svg viewBox="0 0 20 10" className="size-3/4 opacity-60">
                          <path
                            d="M1 5 Q3 2.5 5 5 T9 5 T13 5 T17 5 T19 5"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                    {piece && !lake ? (
                      <span className="block size-[84%] drop-shadow-sm transition-transform active:scale-90">
                        <PieceIcon piece={piece} />
                      </span>
                    ) : null}
                    {isDest && !piece ? (
                      <span className="absolute inset-0 grid place-items-center" aria-hidden>
                        <span className="size-2.5 animate-pulse rounded-full bg-indigo-500/80 ring-2 ring-white/60" />
                      </span>
                    ) : null}
                    {isDest && piece ? (
                      <span className="absolute inset-0 rounded-[3px] ring-2 ring-rose-500" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] text-stone-400 dark:text-stone-500" aria-hidden>
        Sarkanā armija apakšā · zilā augšā
      </div>
    </div>
  );
});
