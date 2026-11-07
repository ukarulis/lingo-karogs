"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { storageGet, storageSet } from "@/lib/store/storage";
import type { AiDifficulty } from "@/lib/karogs/ai";
import { AiGame } from "./AiGame";
import { LocalGame } from "./LocalGame";
import { OnlineGame } from "./OnlineGame";
import { KarogsOnboarding } from "./KarogsOnboarding";

type KarogsMode = "ai" | "local" | "online";

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
      <div className="mb-6 flex justify-center">
        <Segmented<KarogsMode>
          ariaLabel="Spēles režīms"
          value={mode}
          onChange={setMode}
          options={[
            { value: "ai", label: "Pret datoru" },
            { value: "local", label: "Divatā uz viena ekrāna" },
            { value: "online", label: "Spēlēt ar draugu" },
          ]}
        />
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
