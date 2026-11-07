"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "./Keyboard";
import { evaluateGuess } from "@/lib/lingo/engine";
import { useGuessInput } from "./use-guess-input";
import { statusStyle } from "@/lib/lingo/colors";
import { paletteFor } from "@/lib/lingo/colors";
import { useDark } from "@/lib/use-settings";
import { useSettings } from "@/lib/use-settings";

const LEGEND = [
  { word: "krava", target: "kurpe" },
] as const;

function ExampleWord({
  word,
  target,
}: {
  word: string;
  target: string;
}) {
  const dark = useDark();
  const [settings] = useSettings();
  const palette = paletteFor(settings.palette, dark, settings.highContrast);
  const results = evaluateGuess(word, target);
  return (
    <div className="mx-auto grid w-fit grid-cols-5 gap-1.5" aria-hidden>
      {word.split("").map((ch, i) => {
        const style = statusStyle(results[i], palette);
        return (
          <div
            key={i}
            className="grid size-11 place-items-center rounded-lg text-xl font-black uppercase"
            style={{ backgroundColor: style.backgroundColor, color: style.color }}
          >
            {ch}
          </div>
        );
      })}
    </div>
  );
}

function Step3Interactive({ onDone }: { onDone: () => void }) {
  const target = "ābols";
  const [submitted, setSubmitted] = useState<string | null>(null);
  const dark = useDark();
  const [settings] = useSettings();
  const palette = paletteFor(settings.palette, dark, settings.highContrast);
  const { buffer, append, backspace, submit } = useGuessInput({
    enabled: submitted === null,
    fixedPositions: ["ā", null, null, null, null],
    onSubmit: (word) => {
      setSubmitted(word);
      return true;
    },
  });
  const results = submitted ? evaluateGuess(submitted, target) : null;
  return (
    <div>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Izmēģini! Vārds sākas ar <b>Ā</b>. Ieraksti minējumu un nospied Enter.
      </p>
      <div className="mx-auto mt-3 grid w-fit grid-cols-5 gap-1.5">
        {buffer.map((ch, i) => {
          const status = results?.[i];
          const style = status ? statusStyle(status, palette) : null;
          return (
            <div
              key={i}
              className="grid size-11 place-items-center rounded-lg border-2 border-stone-300 text-xl font-black uppercase dark:border-stone-600"
              style={
                style
                  ? { backgroundColor: style.backgroundColor, color: style.color }
                  : i === 0
                    ? { borderColor: "#818cf8", color: "#6366f1" }
                    : undefined
              }
            >
              {ch ?? ""}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Keyboard
          palette={palette}
          evidence={{}}
          disabled={submitted !== null}
          onKey={(key) => {
            if (key === "enter") submit();
            else if (key === "back") backspace();
            else append(key);
          }}
        />
      </div>
      {submitted ? (
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold">
            {submitted === target ? "Pareizi! 🎉" : "Lieliski — tā arī spēlē!"}
          </p>
          <Button className="mt-3" onClick={onDone}>
            Sākt spēli
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function LingoOnboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const dark = useDark();
  const [settings] = useSettings();
  const palette = paletteFor(settings.palette, dark, settings.highContrast);
  return (
    <Dialog open={open} onClose={onClose} title="Kā spēlēt Lingo?" wide>
      <div className="mb-4 flex items-center justify-center gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={
              "h-1.5 rounded-full transition-all " +
              (i === step ? "w-6 bg-indigo-600" : "w-1.5 bg-stone-300 dark:bg-stone-600")
            }
          />
        ))}
      </div>
      {step === 0 ? (
        <div>
          <h3 className="text-base font-bold">Atmini slēpto vārdu</h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            Katrā kārtā dators izdomā <b>piecu burtu</b> latviešu vārdu un atklāj
            tā <b>pirmo burtu</b>. Tev ir <b>5 mēģinājumi</b>, lai vārdu atminētu.
            Pareizi uzminētie burti automātiski parādās nākamajās rindās.
          </p>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            Dienas un neierobežotajā spēlē der jebkura burtu kombinācija;
            klasiskajā režīmā minējumam jābūt vārdnīcā esošam vārdam.
          </p>
        </div>
      ) : step === 1 ? (
        <div>
          <h3 className="text-base font-bold">Burtu krāsas</h3>
          <p className="mt-2 mb-3 text-sm text-stone-600 dark:text-stone-300">
            Minējums “KRAVA” vārdam “KURPE”:
          </p>
          <ExampleWord word={LEGEND[0].word} target={LEGEND[0].target} />
          <div className="mt-4 space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
            {(
              [
                ["correct", "burts ir pareizajā vietā (K)"],
                ["present", "burts ir vārdā, bet citā vietā (R)"],
                ["absent", "burta vārdā nav (A, V)"],
              ] as const
            ).map(([status, text]) => {
              const style = statusStyle(status, palette);
              return (
                <div key={status} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-sm border border-black/10"
                    style={{ backgroundColor: style.backgroundColor }}
                  />
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Step3Interactive onDone={onClose} />
      )}
      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          Izlaist pamācību
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Tālāk</Button>
        ) : null}
      </div>
    </Dialog>
  );
}
