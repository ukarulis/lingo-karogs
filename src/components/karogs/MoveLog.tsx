"use client";

import { ScrollText } from "lucide-react";
import type { MoveRecord } from "@/lib/karogs/engine";
import { BOARD_SIZE, pieceName, xy } from "@/lib/karogs/engine";
import { cn } from "@/lib/utils";

const COL = "ABCDEFGHIJ";

export function describeMove(m: MoveRecord): string {
  const from = `${COL[xy(m.from).x]}${BOARD_SIZE - xy(m.from).y}`;
  const to = `${COL[xy(m.to).x]}${BOARD_SIZE - xy(m.to).y}`;
  const mover = m.side === "red" ? "S" : "Z";
  const rankName = pieceName({ kind: m.attackerKind, rank: m.attackerRank });
  if (m.outcome === "move") return `${mover}: ${rankName} ${from}→${to}`;
  if (m.outcome === "capture-flag") return `${mover}: ${rankName} ${from}→${to} — karogs sagrābts!`;
  if (m.outcome === "lost-attack") {
    const target =
      m.defenderKind === "bomb"
        ? "bumbu"
        : m.defenderKind === "flag"
          ? "karogu"
          : pieceName({ kind: m.defenderKind ?? "movable", rank: m.defenderRank });
    return `${mover}: ${rankName} ${from}→${to} — gāja bojā pret ${target}`;
  }
  const target =
    m.defenderKind === "bomb"
      ? "bumbu (atbruņota)"
      : pieceName({ kind: m.defenderKind ?? "movable", rank: m.defenderRank });
  const mutual = m.captured.length === 2;
  return `${mover}: ${rankName} ${from}→${to} — ${mutual ? "abpusēji iznīcināti" : `uzvarēja ${target}`}`;
}

export function MoveLog({
  moves,
  limit = 10,
  className,
}: {
  moves: MoveRecord[];
  limit?: number;
  className?: string;
}) {
  const visible = moves.slice(-limit);
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900", className)}>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-500 dark:text-stone-400">
        <ScrollText className="size-3.5" aria-hidden />
        Kaujas žurnāls
      </h3>
      <ol className="max-h-44 space-y-1 overflow-y-auto pr-1 text-xs text-stone-600 dark:text-stone-300">
        {visible.length === 0 ? (
          <li className="text-stone-400 dark:text-stone-500">Vēl nav gājienu</li>
        ) : null}
        {visible.map((m, i) => (
          <li key={moves.length - visible.length + i} className="leading-snug">
            <span className="text-stone-400">{moves.length - visible.length + i + 1}.</span> {describeMove(m)}
          </li>
        ))}
      </ol>
    </div>
  );
}
