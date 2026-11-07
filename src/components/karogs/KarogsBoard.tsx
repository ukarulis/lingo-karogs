"use client";

import { memo, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { Cell, Side } from "@/lib/karogs/engine";
import { BOARD_SIZE, LAKE_CELLS, xy } from "@/lib/karogs/engine";
import { cn } from "@/lib/utils";
import { PieceIcon, pieceAriaLabel } from "./PieceIcon";

const COL_LETTERS = "ABCDEFGHIJ";

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
    const cell = Math.min(BOARD_SIZE - 1, Math.max(0, Math.floor((clientX - rect.left) / (rect.width / BOARD_SIZE))));
    const row = Math.min(BOARD_SIZE - 1, Math.max(0, Math.floor((clientY - rect.top) / (rect.height / BOARD_SIZE))));
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
      <div
        className={cn(
          "overflow-x-auto",
          zoom && "overflow-y-auto",
        )}
      >
        <div
          ref={ref}
          role="grid"
          aria-label={boardLabel}
          className={cn(
            "grid aspect-square select-none grid-cols-10 grid-rows-10 gap-[2px] rounded-xl bg-stone-300 p-[3px] dark:bg-stone-700",
            zoom ? "min-w-[520px]" : "w-full",
          )}
          onPointerLeave={() => onCellHover?.(null)}
        >
          {cells.map((piece, i) => {
            const { x, y } = xy(i);
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
                  "relative grid aspect-square place-items-center rounded-[3px] transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-indigo-500",
                  lake
                    ? "bg-sky-400/70 dark:bg-sky-800/80"
                    : "bg-stone-100 dark:bg-stone-800",
                  !lake && !disabled && "hover:bg-stone-200 dark:hover:bg-stone-700",
                  isSelected && "ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400",
                  isLast && !isSelected && "bg-amber-100 dark:bg-amber-900/50",
                  disabled && !lake && "opacity-90",
                )}
              >
                {piece && !lake ? (
                  <span className="block size-[82%] transition-transform active:scale-90">
                    <PieceIcon piece={piece} />
                  </span>
                ) : null}
                {isDest && !piece ? (
                  <span className="absolute inset-0 grid place-items-center" aria-hidden>
                    <span className="size-2.5 rounded-full bg-indigo-500/70" />
                  </span>
                ) : null}
                {isDest && piece ? (
                  <span className="absolute inset-0 rounded-[3px] ring-2 ring-rose-500" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] text-stone-400 dark:text-stone-500" aria-hidden>
        Sarkanā armija apakšā · zilā augšā
      </div>
    </div>
  );
});
