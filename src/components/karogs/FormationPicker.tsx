"use client";

import { memo } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import {
  FORMATIONS,
  RANDOM_FORMATION,
  type Formation,
  formationPreview,
} from "@/lib/karogs/formations";
import { BOARD_SIZE } from "@/lib/karogs/engine";
import { cn } from "@/lib/utils";

const ALL: readonly Formation[] = [...FORMATIONS, RANDOM_FORMATION];

/** 4x10 mini-preview of a formation (blue orientation, row 0 on top). */
function MiniPreview({ formation }: { formation: Formation }) {
  const preview = formationPreview(formation);
  return (
    <div
      aria-hidden
      className="grid w-[88px] shrink-0 grid-cols-10 grid-rows-4 gap-px overflow-hidden rounded-md border border-stone-300 bg-stone-200 dark:border-stone-700 dark:bg-stone-700"
    >
      {preview.flat().map((spec, i) => {
        if (!spec) {
          return <span key={i} className="bg-stone-50 dark:bg-stone-900" />;
        }
        if (spec.kind === "flag") {
          return <span key={i} className="bg-amber-400" title="Karogs" />;
        }
        if (spec.kind === "bomb") {
          return <span key={i} className="bg-stone-800 dark:bg-stone-950" title="Bumba" />;
        }
        const strength = spec.rank / 10;
        return (
          <span
            key={i}
            className="bg-indigo-600"
            style={{ opacity: 0.25 + strength * 0.75 }}
            title={`${spec.rank}`}
          />
        );
      })}
    </div>
  );
}

export const FormationPicker = memo(function FormationPicker({
  selectedId,
  onApply,
}: {
  selectedId: string | null;
  onApply: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-500 dark:text-stone-400">
        <Sparkles className="size-3.5 text-indigo-500" aria-hidden />
        Ātrā formācija — izvēlies gatavu izvietojumu
      </div>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Gatavās formācijas"
      >
        {ALL.map((formation) => {
          const selected = selectedId === formation.id;
          const random = formation.id === RANDOM_FORMATION.id;
          return (
            <button
              key={formation.id}
              aria-pressed={selected}
              onClick={() => onApply(formation.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-2 text-left transition",
                selected
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400 dark:bg-indigo-950"
                  : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600",
              )}
            >
              {random ? (
                <div
                  className="grid w-[88px] shrink-0 grid-rows-4 gap-px rounded-md border border-stone-300 bg-stone-100 p-1 dark:border-stone-700 dark:bg-stone-900"
                  aria-hidden
                >
                  <span className="grid place-items-center rounded bg-indigo-100 text-[10px] font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Shuffle className="size-4" />
                  </span>
                  {Array.from({ length: 3 }, (_, r) => (
                    <span key={r} className="grid grid-cols-10 gap-px" aria-hidden>
                      {Array.from({ length: BOARD_SIZE }, (_, c) => (
                        <span key={c} className="rounded-[1px] bg-stone-200 dark:bg-stone-800" />
                      ))}
                    </span>
                  ))}
                </div>
              ) : (
                <MiniPreview formation={formation} />
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-bold">{formation.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-stone-500 dark:text-stone-400">
                  {formation.description}
                </div>
                {!random ? (
                  <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      + {formation.strength}
                    </span>
                    {" · "}
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      − {formation.tradeoff}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
