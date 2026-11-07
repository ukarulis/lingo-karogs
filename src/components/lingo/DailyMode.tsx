"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LingoBoard, type BoardRow } from "./LingoBoard";
import { Keyboard } from "./Keyboard";
import { ResultDialog } from "./ResultDialog";
import { useGuessInput } from "./use-guess-input";
import {
  type LingoRound,
  createRound,
  fixedLetters,
  keyboardEvidence,
  normalizeRound,
  submitGuess,
} from "@/lib/lingo/engine";
import {
  dailyTarget,
  formatDateLv,
  nextRigaMidnight,
  rigaDateString,
} from "@/lib/lingo/daily";
import { guessSet, frequentTargets } from "@/lib/lingo/words";
import { latvianPack } from "@/lib/lingo/pack/latvian";
import { paletteFor } from "@/lib/lingo/colors";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { useSettings } from "@/lib/use-settings";
import { dailyStreaks, loadLingoStats, recordDaily } from "@/lib/store/lingoStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { loadGame, saveGame } from "@/lib/store/storage";
import { WordInfoCard } from "./WordInfoCard";

interface DailySave {
  date: string;
  round: LingoRound;
}

function isDailySave(raw: unknown): raw is DailySave {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Partial<DailySave>;
  return (
    typeof d.date === "string" &&
    !!d.round &&
    typeof d.round.target === "string" &&
    Array.isArray(d.round.guesses) &&
    Array.isArray(d.round.results)
  );
}

function countdownParts(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function DailyMode({ palette }: { palette: ReturnType<typeof paletteFor> }) {
  const today = rigaDateString();
  const [round, setRound] = useState<LingoRound | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [now, setNow] = useState(0);
  const { push } = useToast();
  const [settings] = useSettings();

  useEffect(() => {
    let target = dailyTarget(today, frequentTargets);
    if (process.env.NEXT_PUBLIC_E2E) {
      const forced = new URLSearchParams(window.location.search).get("word");
      if (forced && /^[a-zāčēģīķļņšūž]{5}$/.test(forced)) target = forced;
    }
    const stored = loadGame<DailySave>("lingoDaily", isDailySave);
    const restored = stored ? normalizeRound(stored.data.round) : null;
    if (
      restored &&
      stored?.data.date === today &&
      restored.target === target
    ) {
      setRound(restored);
    } else {
      setRound(createRound(target, "daily"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (round) saveGame("lingoDaily", { date: today, round }, round.status);
  }, [round, today]);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const finished = round && round.status !== "playing";

  const fixed = useMemo(() => (round ? fixedLetters(round) : []), [round]);

  const { buffer, shakeTick, append, backspace, submit } = useGuessInput({
    enabled: !!round && round.status === "playing",
    fixedPositions: fixed,
    onSubmit: (word) => {
      if (!round) return false;
      try {
        const next = submitGuess(round, word, guessSet);
        setRound(next);
        if (next.status === "won") {
          playSound("win");
          const stats = recordDaily({
            date: today,
            word: next.target,
            won: true,
            attempts: next.attemptsUsed,
            shareGrid: next.results.map((r) => r.map((c) => (c === "correct" ? "G" : c === "present" ? "Y" : "X")).join("")).join("\n"),
          });
          const { current } = dailyStreaks(stats.daily);
          recordGameEvent({ kind: "lingo-won", attempts: next.attemptsUsed, mode: "daily" });
          recordGameEvent({ kind: "lingo-daily-won", streak: current });
          setResultOpen(true);
        } else if (next.status === "lost") {
          playSound("lose");
          recordDaily({
            date: today,
            word: next.target,
            won: false,
            attempts: next.maxAttempts,
            shareGrid: "",
          });
          setResultOpen(true);
        } else {
          playSound("flip");
        }
        return true;
      } catch (err) {
        playSound("error");
        push(err instanceof Error ? err.message : "Nederīgs vārds", "error");
        return false;
      }
    },
  });

  const rows: BoardRow[] = useMemo(() => {
    if (!round) return [];
    return Array.from({ length: round.maxAttempts }, (_, r) => {
      if (r < round.guesses.length) {
        const word = round.guesses[r];
        return {
          state: "done" as const,
          cells: word.split("").map((letter, c) => ({
            letter,
            status: round.results[r][c],
            state: "done" as const,
          })),
        };
      }
      if (r === round.guesses.length && round.status === "playing") {
        return {
          state: "current" as const,
          shake: shakeTick > 0,
          cells: Array.from({ length: round.length }, (_, c) => {
            if (fixed[c]) {
              return { letter: fixed[c], status: "empty" as const, state: "hint" as const };
            }
            return {
              letter: buffer[c] ?? null,
              status: "empty" as const,
              state: buffer[c] ? ("typed" as const) : ("idle" as const),
            };
          }),
        };
      }
      return { state: "empty" as const, cells: Array.from({ length: round.length }, () => ({ letter: null, status: "empty" as const, state: "idle" as const })) };
    });
  }, [round, buffer, fixed, shakeTick]);

  const evidence = useMemo(
    () => (round ? keyboardEvidence(round.guesses, round.results) : {}),
    [round],
  );
  const cd = countdownParts(nextRigaMidnight(now) - now);
  const history = useMemo(() => {
    const daily = loadLingoStats().daily;
    return Object.entries(daily)
      .filter(([date]) => date !== today)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12);
  }, [today]);

  if (!round) return <div className="h-80 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          {formatDateLv(today)}
        </span>
        <span aria-live="off">
          Nākamais vārds pēc {cd.h}:{String(cd.m).padStart(2, "0")}:
          {String(cd.s).padStart(2, "0")}
        </span>
      </div>
      <div aria-live="polite" className="sr-only">
        {round.status === "won"
          ? "Vārds atminēts"
          : round.status === "lost"
            ? "Vārds neatminēts"
            : `${round.guesses.length} mēģinājumi izmantoti`}
      </div>
      <LingoBoard rows={rows} palette={palette} />
      <div className="mt-5">
        <Keyboard
          palette={palette}
          evidence={evidence}
          disabled={!!finished}
          layout={latvianPack.keyboardLayout}
          onKey={(key) => {
            if (key === "enter") submit();
            else if (key === "back") backspace();
            else append(key);
          }}
        />
      </div>
      {round && (
        <ResultDialog
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          round={round}
          title={`Lingo · Dienas vārds ${formatDateLv(today)}`}
          palette={settings.palette}
        />
      )}
      {history.length > 0 ? (
        <div className="mx-auto mt-8 max-w-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-300">
            <History className="size-4" aria-hidden />
            Iepriekšējie dienas vārdi
          </h3>
          <ul className="space-y-1">
            {history.map(([date, entry]) => (
              <li
                key={date}
                className="flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2 text-sm dark:bg-stone-800"
              >
                <span className="font-semibold">{formatDateLv(date)}</span>
                <span className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                  <span className={entry.won ? "text-emerald-600" : "text-red-500"}>
                    {entry.won ? `${entry.attempts}/5` : "X/5"}
                  </span>
                  <span className="text-xs opacity-70">{entry.word.toUpperCase()}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {finished ? (
        <div className="mx-auto mt-4 max-w-sm text-center">
          <Button variant="secondary" size="sm" onClick={() => setResultOpen(true)}>
            Skatīt rezultātu
          </Button>
        </div>
      ) : null}
      {finished ? <WordInfoCard word={round.target} /> : null}
    </div>
  );
}
