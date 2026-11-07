"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Heart, Lightbulb, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LingoBoard, type BoardRow } from "./LingoBoard";
import { Keyboard } from "./Keyboard";
import { useGuessInput } from "./use-guess-input";
import { ResultDialog } from "./ResultDialog";
import {
  type ArcadeSession,
  ARCADE_MAX_LIVES,
  arcadeHint,
  arcadeNextWord,
  arcadeSubmit,
  keyboardEvidence,
  startArcade,
} from "@/lib/lingo/engine";
import { guessSet, pickTarget } from "@/lib/lingo/words";
import { paletteFor } from "@/lib/lingo/colors";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { useSettings } from "@/lib/use-settings";
import { loadLingoStats, recordArcade } from "@/lib/store/lingoStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { storageGet, storageSet } from "@/lib/store/storage";

function Hearts({ lives }: { lives: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-rose-500"
      aria-label={`${lives} dzīvības no ${ARCADE_MAX_LIVES}`}
    >
      {Array.from({ length: ARCADE_MAX_LIVES }, (_, i) => (
        <Heart
          key={i}
          aria-hidden
          className={
            "size-4 sm:size-5 " + (i < lives ? "fill-rose-500" : "fill-transparent opacity-25")
          }
        />
      ))}
    </span>
  );
}

export function ArcadeMode({ palette }: { palette: ReturnType<typeof paletteFor> }) {
  const [session, setSession] = useState<ArcadeSession | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const { push } = useToast();
  const [settings] = useSettings();

  useEffect(() => {
    const stored = storageGet<ArcadeSession>("lingoArcade");
    const params = new URLSearchParams(window.location.search);
    if (process.env.NEXT_PUBLIC_E2E) {
      const forcedWord = params.get("arcadeword");
      const forcedLives = Number(params.get("arcadelives"));
      if (forcedWord && /^[a-zāčēģīķļņšūž]{5}$/.test(forcedWord)) {
        const session = startArcade(forcedWord);
        if (Number.isFinite(forcedLives) && forcedLives >= 1 && forcedLives <= 10) {
          session.lives = forcedLives;
        }
        setSession(session);
        return;
      }
    }
    if (stored && stored.current) {
      setSession(stored);
    } else {
      setSession(startArcade(pickTarget()));
    }
  }, []);

  useEffect(() => {
    if (session) storageSet("lingoArcade", session);
  }, [session]);

  const round = session?.current ?? null;
  const wordDone = !!round && round.status !== "playing";
  const inputEnabled = !!round && round.status === "playing" && !session?.over;

  const fixed = useMemo(
    () =>
      round
        ? round.revealed.map((r, i) => (r ? round.target[i] : null)).map((f, i) => (i === 0 ? round.firstLetter : f))
        : [],
    [round],
  );

  const { buffer, shakeTick, append, backspace, submit } = useGuessInput({
    enabled: inputEnabled,
    fixedPositions: fixed,
    onSubmit: (word) => {
      if (!session) return false;
      try {
        const next = arcadeSubmit(session, word, guessSet);
        const lastEntry = next.history[next.history.length - 1];
        if (next.over) {
          playSound(next.current.status === "won" ? "win" : "lose");
          recordArcade(next.score, next.solved);
          recordGameEvent({ kind: "lingo-arcade-score", score: next.score });
          if (next.current.status === "won") {
            recordGameEvent({ kind: "lingo-won", attempts: next.current.attemptsUsed, mode: "arcade" });
          }
          setResultOpen(true);
        } else if (next.current.status === "won") {
          playSound("win");
          recordGameEvent({ kind: "lingo-won", attempts: next.current.attemptsUsed, mode: "arcade" });
          if (lastEntry.lifeGain) {
            playSound("life");
            push("🎉 Papildu dzīvība par atminējumu ar pirmo mēģinājumu!", "success");
          }
        } else if (next.current.status === "lost") {
          playSound("lose");
          push(`Dzīvība zaudēta. Palikušas ${next.lives}.`, "info");
        } else {
          playSound("flip");
        }
        setSession(next);
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
    return Array.from({ length: 5 }, (_, r) => {
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
          cells: Array.from({ length: 5 }, (_, c) => {
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
      return { state: "empty" as const, cells: Array.from({ length: 5 }, () => ({ letter: null, status: "empty" as const, state: "idle" as const })) };
    });
  }, [round, buffer, fixed, shakeTick]);

  const evidence = useMemo(
    () => (round ? keyboardEvidence(round.guesses, round.results) : {}),
    [round],
  );

  if (!session || !round) {
    return <div className="h-80 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />;
  }

  const best = loadLingoStats().arcade.bestScore;

  return (
    <div>
      <div className="mx-auto mb-3 flex max-w-lg flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-semibold text-stone-600 dark:text-stone-300">
        <Hearts lives={session.lives} />
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb className="size-4 text-amber-500" aria-hidden />
          {session.hints} palīdzības
          <button
            onClick={() => {
              try {
                const next = arcadeHint(session);
                playSound("hint");
                push("Burts atklāts!", "success");
                setSession(next);
              } catch (err) {
                playSound("error");
                push(err instanceof Error ? err.message : "Nav palīdzību", "error");
              }
            }}
            disabled={!inputEnabled || session.hints <= 0}
            className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-40 dark:bg-amber-950 dark:text-amber-300"
          >
            Padoms
          </button>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="size-4 text-indigo-500" aria-hidden />
          {session.score} punkti
        </span>
        <span>Vārdi: {session.solved}</span>
        <span className="text-xs opacity-70">Rekords: {Math.max(best, session.score)}</span>
      </div>
      <div aria-live="polite" className="sr-only">
        {round.status === "won"
          ? `Vārds atminēts, ${session.score} punkti`
          : round.status === "lost"
            ? `Vārds neatminēts, palikušas ${session.lives} dzīvības`
            : `${session.lives} dzīvības`}
      </div>
      <LingoBoard rows={rows} palette={palette} />
      <div className="mt-5">
        <Keyboard
          palette={palette}
          evidence={evidence}
          disabled={!inputEnabled}
          onKey={(key) => {
            if (key === "enter") submit();
            else if (key === "back") backspace();
            else append(key);
          }}
        />
      </div>
      {wordDone && !session.over ? (
        <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-sm font-semibold">
            {round.status === "won"
              ? `“${round.target.toUpperCase()}” atminēts! +${session.history[session.history.length - 1]?.points ?? 0} punkti`
              : `Vārds bija “${round.target.toUpperCase()}”. −1 dzīvība`}
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              playSound("start");
              setSession((s) => (s ? arcadeNextWord(s, pickTarget(Math.random, new Set(s.history.slice(-10).map((h) => h.word)))) : s));
            }}
          >
            Nākamais vārds <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
      {session.over && round ? (
        <ResultDialog
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          round={round}
          title={`Lingo klasika · ${session.score} punkti`}
          palette={settings.palette}
        />
      ) : null}
      {session.over ? (
        <div className="mx-auto mt-5 flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="font-bold">Spēle beigusies — dzīvības izsmeltas</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Galarezultāts: {session.score} punkti, {session.solved} vārdi.
          </p>
          <Button
            className="mt-1"
            onClick={() => {
              playSound("start");
              setSession(startArcade(pickTarget()));
              setResultOpen(false);
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Spēlēt vēlreiz
          </Button>
        </div>
      ) : null}
    </div>
  );
}
