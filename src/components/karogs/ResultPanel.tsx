"use client";

import { RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameState, Side } from "@/lib/karogs/engine";
import { cn } from "@/lib/utils";

export function endLabel(state: Pick<GameState, "winner">): string {
  if (state.winner === "draw") return "Neizšķirts";
  if (state.winner === "red") return "Uzvarēja sarkanā armija";
  if (state.winner === "blue") return "Uzvarēja zilā armija";
  return "Spēle beigusies";
}

export function reasonLabel(reason: string | null): string {
  switch (reason) {
    case "flag-captured":
      return "karogs tika sagrābts";
    case "no-legal-moves":
      return "pretiniekam nebija iespējamu gājienu";
    case "resignation":
      return "pretinieks padevās";
    case "repetition":
      return "pozīcija atkārtojās trīsreiz";
    case "no-capture":
      return "120 gājieni bez kaujām";
    case "abandoned":
      return "pretinieks pameta spēli";
    default:
      return reason ?? "";
  }
}

export function ResultPanel({
  state,
  viewer,
  onReplay,
  onClose,
  reveal,
  setReveal,
}: {
  state: GameState;
  viewer: Side | null;
  onReplay?: () => void;
  onClose?: () => void;
  reveal: boolean;
  setReveal: (v: boolean) => void;
}) {
  const youWon =
    viewer && state.winner === viewer;
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 text-center shadow-sm",
        state.winner === "draw"
          ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
          : youWon
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
      )}
    >
      <div className="text-lg font-extrabold">
        {state.winner === "draw" ? "Neizšķirts" : youWon ? "Uzvara! 🎉" : "Zaudējums"}
      </div>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
        {endLabel(state)} — {reasonLabel(state.endReason)}.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setReveal(!reveal)}>
          <Swords className="size-4" aria-hidden />
          {reveal ? "Slēpt armijas" : "Atklāt visas figūras"}
        </Button>
        {onReplay ? (
          <Button size="sm" onClick={onReplay}>
            <RotateCcw className="size-4" aria-hidden />
            Spēlēt vēlreiz
          </Button>
        ) : null}
        {onClose ? (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Aizvērt
          </Button>
        ) : null}
      </div>
    </div>
  );
}

