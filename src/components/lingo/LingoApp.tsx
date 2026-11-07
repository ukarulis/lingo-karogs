"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Palette } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useDark, useSettings } from "@/lib/use-settings";
import { paletteFor, statusStyle, type Palette as LingoPalette } from "@/lib/lingo/colors";
import type { CellStatus } from "@/lib/lingo/engine";
import { storageGet, storageSet } from "@/lib/store/storage";
import { DailyMode } from "./DailyMode";
import { EndlessMode } from "./EndlessMode";
import { ArcadeMode } from "./ArcadeMode";
import { OnlineMode } from "./OnlineMode";
import { LingoOnboarding } from "./Onboarding";

type LingoMode = "daily" | "endless" | "arcade" | "online";

function ColorLegend({
  palette,
}: {
  palette: LingoPalette;
}) {
  const items: Array<{ status: CellStatus; label: string }> = [
    { status: "correct", label: "Pareizā vietā" },
    { status: "present", label: "Citā vietā" },
    { status: "absent", label: "Nav vārdā" },
  ];
  return (
    <span
      className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
      aria-label="Burtu krāsu skaidrojums"
    >
      {items.map(({ status, label }) => {
        const style = statusStyle(status, palette);
        return (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-sm border border-black/10"
              style={{ backgroundColor: style.backgroundColor }}
            />
            {label}
          </span>
        );
      })}
    </span>
  );
}

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
            { value: "online", label: "Spēlēt ar draugu" },
          ]}
        />
      </div>
      {mode === "daily" ? <DailyMode palette={palette} /> : null}
      {mode === "endless" ? <EndlessMode palette={palette} /> : null}
      {mode === "arcade" ? <ArcadeMode palette={palette} /> : null}
      {mode === "online" ? <OnlineMode palette={palette} /> : null}
      <div className="mx-auto mt-5 max-w-md text-center text-xs text-stone-500 dark:text-stone-400">
        {mode !== "online" ? <ColorLegend palette={palette} /> : null}
      </div>
      <p className="mx-auto mt-5 max-w-md text-center text-xs text-stone-500 dark:text-stone-400">
        {mode === "online"
          ? "Tiešsaistes spēlēs ir spēkā tie paši noteikumi: brīvie minējumi, pārnešana un servera kontrolēts laiks."
          : mode === "arcade"
            ? "Klasiskajā režīmā katram minējumam jābūt vārdnīcā esošam vārdam."
            : "Brīvais minējums: der jebkura izvēlētā garuma burtu kombinācija — tai nav jābūt vārdnīcā."}
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
