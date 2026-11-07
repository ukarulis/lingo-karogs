"use client";

import { useMemo, useRef, useState, type SetStateAction } from "react";
import {
  Check,
  ChevronDown,
  Dices,
  FolderDown,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Piece,
  type Side,
  ARMY,
  ARMY_SIZE,
  inZone,
  isLake,
  randomSetup,
} from "@/lib/karogs/engine";
import { applyFormation, formationById } from "@/lib/karogs/formations";
import { FormationPicker } from "./FormationPicker";
import { cn } from "@/lib/utils";
import { storageGet, storageSet } from "@/lib/store/storage";

export interface SavedFormation {
  name: string;
  cells: Record<number, { kind: Piece["kind"]; rank: number | null }>;
}

export function loadFormations(): SavedFormation[] {
  return storageGet<SavedFormation[]>("karogsFormations") ?? [];
}

function makePiece(
  side: Side,
  kind: Piece["kind"],
  rank: number | null,
  index: number,
): Piece {
  return {
    id: `${side}-${rank ?? kind}-${index}`,
    owner: side,
    kind,
    rank,
    redSees: side === "red",
    blueSees: side === "blue",
  };
}

function entryRank(entry: (typeof ARMY)[number]): number | null {
  return entry.kind === "movable" ? (entry.rank as number) : null;
}

type Spec = { kind: Piece["kind"]; rank: number | null };

export interface SetupController {
  selected: Spec | null;
  setSelected: (s: SetStateAction<Spec | null>) => void;
  formationId: string | null;
  applyPreset: (id: string) => void;
  placedCounts: Map<string, number>;
  totalPlaced: number;
  dragRef: React.MutableRefObject<Spec | null>;
  handleCell: (idx: number) => void;
  handleDrop: (idx: number) => void;
  applyRandom: () => void;
  applyClear: () => void;
}

export function useSetupController(
  side: Side,
  placement: Record<number, Piece>,
  onPlacementChange: (p: Record<number, Piece>) => void,
  options: { initialFormationId?: string } = {},
): SetupController {
  const [selected, setSelected] = useState<Spec | null>(null);
  const [formationId, setFormationId] = useState<string | null>(
    options.initialFormationId ?? null,
  );
  const dragRef = useRef<Spec | null>(null);

  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const piece of Object.values(placement)) {
      const key = `${piece.kind}:${piece.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [placement]);

  const usedIds = useMemo(() => {
    const ids = new Map<string, number>();
    for (const piece of Object.values(placement)) {
      const prefix = `${piece.owner}-${piece.rank ?? piece.kind}`;
      ids.set(prefix, Math.max(ids.get(prefix) ?? -1, Number(piece.id.split("-").pop() ?? -1)));
    }
    return ids;
  }, [placement]);

  const placeSpec = (idx: number, spec: Spec) => {
    if (!inZone(side, idx) || isLake(idx)) return;
    const existing = placement[idx];
    if (existing && existing.kind === spec.kind && existing.rank === spec.rank) {
      const next = { ...placement };
      delete next[idx];
      onPlacementChange(next);
      setFormationId(null);
      return;
    }
    const prefix = `${side}-${spec.rank ?? spec.kind}`;
    const idIndex = (usedIds.get(prefix) ?? -1) + 1;
    const piece = makePiece(side, spec.kind, spec.rank, idIndex);
    onPlacementChange({ ...placement, [idx]: piece });
    setFormationId(null);
  };

  const handleCell = (idx: number) => {
    if (!selected) return;
    placeSpec(idx, selected);
  };

  // The drop path uses the dragged piece directly — never the React
  // selection state, which can be stale immediately after pointer-down.
  const handleDrop = (idx: number) => {
    const spec = dragRef.current;
    dragRef.current = null;
    if (!spec) return;
    placeSpec(idx, spec);
    setSelected(null);
  };

  return {
    selected,
    setSelected,
    formationId,
    applyPreset: (id: string) => {
      const formation = formationById(id);
      if (!formation) return;
      onPlacementChange(applyFormation(formation, side, Math.random));
      setFormationId(id);
    },
    placedCounts,
    totalPlaced: Object.keys(placement).length,
    dragRef,
    handleCell,
    handleDrop,
    applyRandom: () => {
      onPlacementChange(randomSetup(side, Math.random));
      setFormationId(null);
    },
    applyClear: () => {
      onPlacementChange({});
      setFormationId(null);
    },
  };
}

export function SetupPanel({
  side,
  placement,
  controller,
  onPlacementChange,
  onReady,
  ready,
  readyLabel = "Gatavs kaujai",
}: {
  side: Side;
  placement: Record<number, Piece>;
  controller: SetupController;
  onPlacementChange: (p: Record<number, Piece>) => void;
  onReady?: () => void;
  ready?: boolean;
  readyLabel?: string;
}) {
  const [formName, setFormName] = useState("");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [formationsOpen, setFormationsOpen] = useState(false);
  const { selected, setSelected, placedCounts, totalPlaced } = controller;

  const saveFormation = () => {
    const formations = loadFormations();
    const cells: SavedFormation["cells"] = {};
    for (const [cell, piece] of Object.entries(placement)) {
      cells[Number(cell)] = { kind: piece.kind, rank: piece.rank };
    }
    storageSet(
      "karogsFormations",
      [
        { name: formName.trim(), cells },
        ...formations.filter((f) => f.name !== formName.trim()),
      ].slice(0, 6),
    );
    setFormName("");
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          {side === "red" ? "Sarkanā armija" : "Zilā armija"}{" "}
          <span
            className={cn(
              "tabular-nums",
              totalPlaced === ARMY_SIZE ? "text-emerald-600" : "text-stone-400",
            )}
          >
            {totalPlaced}/{ARMY_SIZE}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setFormationsOpen((v) => !v)}
          aria-expanded={formationsOpen}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          {formationsOpen ? "Aizvērt formācijas" : "Izvēlēties formāciju"}
          <ChevronDown
            className={cn("size-3.5 transition-transform", formationsOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {formationsOpen ? (
        <FormationPicker
          selectedId={controller.formationId}
          onApply={controller.applyPreset}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {onReady ? (
          <Button className="min-w-40 flex-1" disabled={totalPlaced !== ARMY_SIZE || ready} onClick={onReady}>
            {ready ? <Check className="size-4" aria-hidden /> : null}
            {ready ? "Gatavs — gaida pretinieku" : readyLabel}
          </Button>
        ) : null}
        <Button variant="secondary" size="md" onClick={controller.applyRandom}>
          <Dices className="size-4" aria-hidden />
          Izveidot nejauši
        </Button>
        <Button
          variant="outline"
          size="md"
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((v) => !v)}
        >
          <Settings2 className="size-4" aria-hidden />
          Pielāgot izvietojumu
        </Button>
      </div>

      {customizeOpen ? (
        <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
          <div
            className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
            role="group"
            aria-label="Figūru krātuve"
          >
            {ARMY.map((entry) => {
              const key = `${entry.kind}:${entry.rank}`;
              const remaining = entry.count - (placedCounts.get(key) ?? 0);
              const isSel = selected?.kind === entry.kind && selected?.rank === entry.rank;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={remaining <= 0}
                  onPointerDown={() => {
                    if (remaining > 0) {
                      controller.dragRef.current = { kind: entry.kind, rank: entryRank(entry) };
                      setSelected({ kind: entry.kind, rank: entryRank(entry) });
                    }
                  }}
                  onClick={() =>
                    setSelected((s) =>
                      s?.kind === entry.kind && s.rank === entryRank(entry)
                        ? null
                        : { kind: entry.kind, rank: entryRank(entry) },
                    )
                  }
                  aria-pressed={isSel}
                  className={cn(
                    "relative rounded-xl border p-2 text-center transition",
                    isSel
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400 dark:bg-indigo-950"
                      : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600",
                    remaining <= 0 && "opacity-35",
                  )}
                >
                  <div className="text-[11px] font-bold leading-tight">
                    {entry.kind === "flag" ? "Karogs" : entry.kind === "bomb" ? "Bumba" : entry.name}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {entry.kind === "movable" ? `Rangs ${entry.rank}` : "Nekustīgs"} · {remaining}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={controller.applyClear}>
              <Trash2 className="size-4" aria-hidden />
              Notīrīt
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Formācijas nosaukums"
                maxLength={20}
                aria-label="Formācijas nosaukums"
                className="h-9 w-36 rounded-lg border border-stone-300 bg-white px-2 text-xs dark:border-stone-600 dark:bg-stone-800"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={totalPlaced !== ARMY_SIZE || !formName.trim()}
                onClick={saveFormation}
              >
                <Save className="size-4" aria-hidden />
                Saglabāt
              </Button>
            </div>
          </div>
          {(() => {
            const formations = loadFormations();
            if (formations.length === 0) return null;
            return (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {formations.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      const next: Record<number, Piece> = {};
                      const counters: Record<string, number> = {};
                      for (const [cell, spec] of Object.entries(f.cells)) {
                        const prefix = `${side}-${spec.rank ?? spec.kind}`;
                        const n = counters[prefix] ?? 0;
                        counters[prefix] = n + 1;
                        next[Number(cell)] = makePiece(side, spec.kind, spec.rank, n);
                      }
                      onPlacementChange(next);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  >
                    <FolderDown className="size-3.5" aria-hidden />
                    {f.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
