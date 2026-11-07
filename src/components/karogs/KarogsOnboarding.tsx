"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2;

function MiniCell({
  label,
  kind,
  onClick,
  highlight,
  dim,
}: {
  label?: string;
  kind?: "red" | "blue" | "bomb" | "flag" | "empty" | "water";
  onClick?: () => void;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <button
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "grid aspect-square place-items-center rounded-md border text-xs font-bold transition",
        kind === "water" && "bg-sky-300/80 border-sky-400",
        kind === "empty" && "bg-stone-100 border-stone-200 dark:bg-stone-800 dark:border-stone-700",
        kind === "red" && "bg-red-500 border-red-700 text-white",
        kind === "blue" && "bg-blue-500 border-blue-700 text-white",
        kind === "bomb" && "bg-stone-900 border-stone-950 text-white",
        kind === "flag" && "bg-amber-200 border-amber-400 text-amber-900",
        highlight && "ring-2 ring-indigo-500",
        dim && "opacity-40",
      )}
    >
      {label}
    </button>
  );
}

export function KarogsOnboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [placed, setPlaced] = useState(0);
  const [scoutAt, setScoutAt] = useState(2);
  const [defused, setDefused] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Kā spēlēt Karogu?" wide>
      <div className="mb-4 flex justify-center gap-2" aria-hidden>
        {([0, 1, 2] as const).map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-6 bg-indigo-600" : "w-1.5 bg-stone-300 dark:bg-stone-600",
            )}
          />
        ))}
      </div>

      {step === 0 ? (
        <div>
          <h3 className="text-base font-bold">Izvieto armiju</h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Katram spēlētājam ir <b>40 figūras</b> — karogs, bumbas, maršals, spiegs un
            citi. Izvieto tās savā zonā; pretinieks tavu izvietojumu neredz.
          </p>
          <div className="mx-auto mt-3 grid w-64 grid-cols-5 gap-1">
            {Array.from({ length: 25 }, (_, i) => {
              const row = Math.floor(i / 5);
              const inZone = row >= 3;
              const isLake = [11, 12].includes(i);
              const piece =
                i === 22
                  ? "2"
                  : i === 21 && placed > 0
                    ? "3"
                    : i === 20 && placed > 1
                      ? "10"
                      : undefined;
              return (
                <MiniCell
                  key={i}
                  kind={
                    isLake
                      ? "water"
                      : piece
                        ? "red"
                        : inZone
                          ? "empty"
                          : undefined
                  }
                  label={piece}
                  onClick={
                    inZone && !piece && placed < 3
                      ? () => setPlaced((p) => p + 1)
                      : undefined
                  }
                />
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-stone-400">
            Zilie lauciņi — ezers. Figūras liec tikai savā zonā (pelēkā).
          </p>
        </div>
      ) : step === 1 ? (
        <div>
          <h3 className="text-base font-bold">Gājieni un uzbrukumi</h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Parastas figūras iet <b>vienu lauciņu</b> uz augšu, leju, pa kreisi vai
            pa labi. <b>Izlūks (2)</b> var iet vairākus lauciņus taisnā līnijā.
            Uzejot uz pretinieka figūras, sākas kauja — lielākais rangs uzvar.
          </p>
          <div className="mx-auto mt-3 grid w-72 grid-cols-6 gap-1">
            {Array.from({ length: 24 }, (_, i) => {
              const isScout = i === scoutAt;
              const scoutRange = [0, 6, 12, 18].map((start) =>
                start === 0 && scoutAt % 6 === i % 6 && i !== scoutAt ? i : start === 6 && scoutAt % 6 === i % 6 && i > 6 && i !== scoutAt ? i : start === 12 && scoutAt % 6 === i % 6 && i > 12 && i !== scoutAt ? i : start === 18 && scoutAt % 6 === i % 6 && i > 18 && i !== scoutAt ? i : -1,
              ).filter((v) => v >= 0);
              const inRange = scoutRange.includes(i);
              return (
                <MiniCell
                  key={i}
                  kind={isScout ? "red" : i === 1 ? "blue" : "empty"}
                  label={isScout ? "2" : i === 1 ? "5" : undefined}
                  highlight={inRange}
                  onClick={
                    isScout
                      ? () => {
                          if (scoutAt === 2) setScoutAt(0);
                          else setScoutAt(2);
                        }
                      : inRange
                        ? () => setScoutAt(i)
                        : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-base font-bold">Speciālās figūras</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
            <li><b>Mīnētājs (3)</b> — vienīgais, kas var atbruņot bumbu.</li>
            <li><b>Bumba</b> — uzvar jebkuru uzbrucēju, izņemot mīnētāju.</li>
            <li><b>Spiegs (S)</b> — uzveic maršalu (10), bet tikai uzbrukdams.</li>
            <li><b>Karogs</b> — sagrāb to un uzvari spēli!</li>
          </ul>
          <div className="mx-auto mt-3 grid w-64 grid-cols-5 gap-1">
            {Array.from({ length: 15 }, (_, i) => {
              const isBomb = i === 12;
              const isMiner = i === 7;
              const isDead = defused && isBomb;
              return (
                <MiniCell
                  key={i}
                  kind={isBomb && !isDead ? "bomb" : isMiner ? "red" : "empty"}
                  label={isBomb && !isDead ? "B" : isMiner ? "3" : undefined}
                  highlight={!defused && (isBomb || isMiner)}
                  dim={defused}
                  onClick={
                    isBomb || isMiner
                      ? () => {
                          setDefused(true);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-stone-400" aria-live="polite">
            {defused ? "Bumba atbruņota! 💥" : "Pieskaries bumbai, lai mīnētājs to atbruņo."}
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          Izlaist pamācību
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)}>Tālāk</Button>
        ) : (
          <Button onClick={onClose}>Sākt spēli</Button>
        )}
      </div>
    </Dialog>
  );
}
