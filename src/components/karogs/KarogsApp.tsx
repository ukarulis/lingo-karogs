"use client";

import { useEffect, useState } from "react";
import { Bot, Globe, HelpCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { storageGet, storageSet } from "@/lib/store/storage";
import type { AiDifficulty } from "@/lib/karogs/ai";
import { AiGame } from "./AiGame";
import { LocalGame } from "./LocalGame";
import { OnlineGame } from "./OnlineGame";
import { KarogsOnboarding } from "./KarogsOnboarding";

type KarogsMode = "ai" | "local" | "online";

const MODES: Array<{
  value: KarogsMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "ai",
    label: "Pret datoru",
    description: "Trīs grūtības līmeņi, tūlītējs sākums.",
    icon: Bot,
  },
  {
    value: "local",
    label: "Divatā uz viena ekrāna",
    description: "Privātuma aizkars starp gājieniem.",
    icon: Users,
  },
  {
    value: "online",
    label: "Spēlēt ar draugu",
    description: "Privāta istaba ar saiti vai kodu.",
    icon: Globe,
  },
];

export function KarogsApp({ initialCode }: { initialCode?: string }) {
  const [mode, setMode] = useState<KarogsMode>(initialCode ? "online" : "ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (storageGet<boolean>("karogsOnboarded") !== true) {
      setOnboardingOpen(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Karogs</h1>
        <button
          onClick={() => setOnboardingOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <HelpCircle className="size-4" aria-hidden />
          Kā spēlēt?
        </button>
      </div>
      <div
        role="radiogroup"
        aria-label="Spēles režīms"
        className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {MODES.map((o) => {
          const selected = mode === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(o.value)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500",
                selected
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400 dark:bg-indigo-950"
                  : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  selected
                    ? "bg-indigo-600 text-white"
                    : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
                )}
              >
                <o.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{o.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-stone-500 dark:text-stone-400">
                  {o.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === "ai" ? (
        <AiGame difficulty={difficulty} onDifficultyChange={setDifficulty} />
      ) : null}
      {mode === "local" ? <LocalGame /> : null}
      {mode === "online" ? <OnlineGame initialCode={initialCode} /> : null}
      <KarogsOnboarding
        open={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          storageSet("karogsOnboarded", true);
        }}
      />
    </div>
  );
}
