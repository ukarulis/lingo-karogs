"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Palette } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useDark, useSettings } from "@/lib/use-settings";
import { paletteFor } from "@/lib/lingo/colors";
import { storageGet, storageSet } from "@/lib/store/storage";
import { DailyMode } from "./DailyMode";
import { EndlessMode } from "./EndlessMode";
import { ArcadeMode } from "./ArcadeMode";
import { LingoOnboarding } from "./Onboarding";

type LingoMode = "daily" | "endless" | "arcade";

export function LingoApp() {
  const [mode, setMode] = useState<LingoMode>("daily");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const dark = useDark();
  const [settings] = useSettings();
  const palette = useMemo(
    () => paletteFor(settings.palette, dark, settings.highContrast),
    [settings.palette, settings.highContrast, dark],
  );

  useEffect(() => {
    if (storageGet<boolean>("lingoOnboarded") !== true) {
      setOnboardingOpen(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Lingo</h1>
        <button
          onClick={() => setOnboardingOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <HelpCircle className="size-4" aria-hidden />
          Kā spēlēt?
        </button>
      </div>
      <div className="mb-6 flex justify-center">
        <Segmented<LingoMode>
          ariaLabel="Spēles režīms"
          value={mode}
          onChange={setMode}
          options={[
            { value: "daily", label: "Dienas vārds" },
            { value: "endless", label: "Neierobežotā" },
            { value: "arcade", label: "Klasiskais Lingo" },
          ]}
        />
      </div>
      {mode === "daily" ? <DailyMode palette={palette} /> : null}
      {mode === "endless" ? <EndlessMode palette={palette} /> : null}
      {mode === "arcade" ? <ArcadeMode palette={palette} /> : null}
      <p className="mx-auto mt-5 max-w-md text-center text-xs text-stone-500 dark:text-stone-400">
        {mode === "arcade"
          ? "Klasiskajā režīmā katram minējumam jābūt vārdnīcā esošam vārdam."
          : "Brīvais minējums: der jebkura 5 burtu kombinācija — tai nav jābūt vārdnīcā."}
      </p>
      <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-1.5 text-center text-xs text-stone-400 dark:text-stone-500">
        <Palette className="size-3.5" aria-hidden />
        {settings.palette === "legacy"
          ? "Ieslēgta vēsturiskā krāsu shēma (sarkans = pareizi, zaļš = burta nav)."
          : settings.highContrast
            ? "Ieslēgts augsta kontrasta režīms."
            : "Krāsu shēmu vari mainīt iestatījumos."}
      </p>
      <LingoOnboarding
        open={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          storageSet("lingoOnboarded", true);
        }}
      />
    </div>
  );
}
