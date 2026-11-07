"use client";

import { memo } from "react";
import { Check, Shuffle, ShieldAlert, Zap } from "lucide-react";
import {
  FORMATIONS,
  RANDOM_FORMATION,
  type Formation,
  formationPreview,
} from "@/lib/karogs/formations";
import { cn } from "@/lib/utils";

const ALL: readonly Formation[] = [...FORMATIONS, RANDOM_FORMATION];

/** 4x10 mini-preview of a formation (blue orientation, row 0 on top). */
function MiniPreview({ formation }: { formation: Formation }) {
  const preview = formationPreview(formation);
  return (
    <div
      aria-hidden
      className="grid w-28 shrink-0 grid-cols-10 grid-rows-4 gap-px overflow-hidden rounded-lg border border-stone-300 bg-stone-200 dark:border-stone-700 dark:bg-stone-700"
    >
      {preview.flat().map((spec, i) => {
        if (!spec) {
          return <span key={i} className="bg-stone-50 dark:bg-stone-900" />;
        }
        if (spec.kind === "flag") {
          return <span key={i} className="bg-amber-400" />;
        }
        if (spec.kind === "bomb") {
          return <span key={i} className="bg-stone-800 dark:bg-stone-950" />;
        }
        const strength = spec.rank / 10;
        return (
          <span
            key={i}
            className="bg-indigo-600"
            style={{ opacity: 0.25 + strength * 0.75 }}
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
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {ALL.map((formation) => {
        const selected = selectedId === formation.id;
        const random = formation.id === RANDOM_FORMATION.id;
        return (
          <button
            key={formation.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onApply(formation.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500",
              selected
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400 dark:bg-indigo-950"
                : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600",
            )}
          >
            {random ? (
              <div
                className="grid w-28 shrink-0 place-items-center self-stretch rounded-lg border border-dashed border-stone-300 bg-stone-100 dark:border-stone-600 dark:bg-stone-900"
                aria-hidden
              >
                <Shuffle className="size-6 text-indigo-500" />
              </div>
            ) : (
              <MiniPreview formation={formation} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold">{formation.name}</span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500 dark:text-stone-400">
                {formation.description}
              </p>
              {!random ? (
                <div className="mt-1.5 space-y-0.5 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Zap className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{formation.strength}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{formation.tradeoff}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
});
