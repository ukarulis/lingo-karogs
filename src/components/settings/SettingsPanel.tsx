"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Gamepad2,
  Moon,
  Palette,
  ShieldCheck,
  Trash2,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { useSettings } from "@/lib/use-settings";
import {
  clearGuestData,
  peekGameSave,
  storageRemove,
} from "@/lib/store/storage";
import { useToast } from "@/lib/toast";

const SAVED_GAMES = [
  { key: "lingoDaily", label: "Lingo · dienas vārds", href: "/lingo" },
  { key: "lingoEndless", label: "Lingo · neierobežotā spēle", href: "/lingo" },
  { key: "lingoArcade", label: "Lingo · klasiskais", href: "/lingo" },
  { key: "karogsAiGame", label: "Karogs · pret datoru", href: "/karogs" },
  { key: "karogsLocalGame", label: "Karogs · divatā", href: "/karogs" },
] as const;

function statusLabel(status: string | null): string {
  switch (status) {
    case "playing":
      return "Notiek spēle";
    case "setup":
      return "Sagatavošanās";
    case "won":
    case "lost":
    case "finished":
    case "over":
      return "Pabeigta";
    default:
      return "Saglabāta";
  }
}

export function SettingsPanel() {
  const [settings, update] = useSettings();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savesTick, setSavesTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const activeSaves = useMemo(
    () => {
      if (!hydrated) return [];
      return SAVED_GAMES.map((g) => ({ ...g, meta: peekGameSave(g.key) })).filter(
        (g) => g.meta !== null,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savesTick, hydrated],
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Moon className="size-4" aria-hidden />
            Tēma
          </div>
          <div className="mt-2">
            <Segmented
              ariaLabel="Tēma"
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: "light", label: "Gaišā" },
                { value: "dark", label: "Tumšā" },
                { value: "system", label: "Kā sistēmā" },
              ]}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Palette className="size-4" aria-hidden />
            Lingo krāsu shēma
          </div>
          <div className="mt-2">
            <Segmented
              ariaLabel="Lingo krāsu shēma"
              value={settings.palette}
              onChange={(palette) => update({ palette })}
              options={[
                { value: "modern", label: "Mūsdienu (zaļš)" },
                { value: "legacy", label: "Vēsturiskā (sarkans)" },
              ]}
            />
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4" aria-hidden />
            Augsta kontrasta režīms
            <span className="hidden text-xs font-normal text-stone-400 sm:inline">
              (krāsu redzes traucējumiem draudzīga shēma)
            </span>
          </span>
          <Switch
            checked={settings.highContrast}
            onCheckedChange={(highContrast) => update({ highContrast })}
            label="Augsta kontrasta režīms"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <Volume2 className="size-4" aria-hidden />
            Skaņas efekti
          </span>
          <Switch
            checked={settings.sound}
            onCheckedChange={(sound) => update({ sound })}
            label="Skaņas efekti"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">Samazināta kustība</span>
          <Switch
            checked={settings.reducedMotion}
            onCheckedChange={(reducedMotion) => update({ reducedMotion })}
            label="Samazināta kustība"
          />
        </label>
      </Card>

      <Card className="p-5">
        <label className="block text-sm font-bold">
          Tavs segvārds
          <input
            value={settings.nickname}
            onChange={(e) => update({ nickname: e.target.value.slice(0, 20) })}
            placeholder="Spēlētājs"
            className="mt-2 h-11 w-full max-w-xs rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium dark:border-stone-600 dark:bg-stone-800"
          />
        </label>
        <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
          Segvārds tiek rādīts tiešsaistes spēlēs un līderu tabulā. Atļauti burti,
          cipari, atstarpes, punkti un defises (2–20 zīmes).
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-bold">Dati un privātums</h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Visa statistika, sasniegumi, iestatījumi un aktīvās spēles glabājas tikai
          šajā ierīcē. Dzēšana ir neatgriezeniska.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Dzēst visus vietējos datus
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Gamepad2 className="size-4 text-indigo-500" aria-hidden />
          Spēļu progress
        </h2>
        {activeSaves.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Nav saglabātu spēļu. Sāc spēli, un tā automātiski saglabāsies šajā ierīcē.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activeSaves.map((game) => (
              <li
                key={game.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-stone-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{game.label}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    {statusLabel(game.meta?.status ?? null)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Link
                    href={game.href}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-500"
                  >
                    Turpināt spēli
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      storageRemove(game.key);
                      setSavesTick((t) => t + 1);
                      push("Spēles progress izdzēsts", "info");
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-stone-600 transition hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    Dzēst progresu
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Progresa dzēšana neietekmē statistiku un sasniegumus.
        </p>
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Dzēst visus datus?"
      >
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Tiks dzēsta visa statistika, sasniegumi, saglabātās formācijas un
          aktīvo spēļu dati šajā ierīcē. Šo darbību nevar atsaukt.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Atcelt
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              clearGuestData();
              setConfirmOpen(false);
              push("Visi vietējie dati ir izdzēsti", "success");
              window.setTimeout(() => window.location.reload(), 600);
            }}
          >
            Dzēst neatgriezeniski
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
