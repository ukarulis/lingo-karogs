"use client";

import { useEffect, useMemo, useState } from "react";
import { Infinity as InfinityIcon, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LingoBoard, type BoardRow } from "./LingoBoard";
import { Keyboard } from "./Keyboard";
import { useGuessInput } from "./use-guess-input";
import {
  type LingoRound,
  createRound,
  keyboardEvidence,
  submitGuess,
} from "@/lib/lingo/engine";
import { guessSet, pickTarget } from "@/lib/lingo/words";
import { paletteFor } from "@/lib/lingo/colors";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { recordEndless } from "@/lib/store/lingoStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { loadGame, saveGame } from "@/lib/store/storage";

interface EndlessState {
  round: LingoRound;
  recent: string[];
  streak: number;
  bestStreak: number;
}

function newWord(state: EndlessState): EndlessState {
  const target = pickTarget(Math.random, new Set(state.recent));
  return {
    ...state,
    round: createRound(target, "endless"),
    recent: [...state.recent, target].slice(-30),
  };
}

function isEndlessState(raw: unknown): raw is EndlessState {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<EndlessState>;
  return (
    !!s.round &&
    typeof s.round.target === "string" &&
    Array.isArray(s.round.guesses) &&
    Array.isArray(s.recent)
  );
}

export function EndlessMode({ palette }: { palette: ReturnType<typeof paletteFor> }) {
  const [state, setState] = useState<EndlessState | null>(null);
  const { push } = useToast();

  useEffect(() => {
    let stored = loadGame<EndlessState>("lingoEndless", isEndlessState)?.data ?? null;
    if (!stored || !stored.round) {
      const target = pickTarget();
      stored = { round: createRound(target, "endless"), recent: [target], streak: 0, bestStreak: 0 };
    }
    setState(stored);
  }, []);

  useEffect(() => {
    if (state) saveGame("lingoEndless", state, state.round.status);
  }, [state]);

  const round = state?.round ?? null;
  const finished = round?.status !== "playing" && round != null;

  const fixed = useMemo(
    () => (round ? Array.from({ length: 5 }, (_, i) => (i === 0 ? round.firstLetter : null)) : []),
    [round],
  );

  const { buffer, shakeTick, append, backspace, submit } = useGuessInput({
    enabled: !!round && round.status === "playing",
    fixedPositions: fixed,
    onSubmit: (word) => {
      if (!round || !state) return false;
      try {
        const next = submitGuess(round, word, guessSet);
        if (next.status === "playing") {
          setState({ ...state, round: next });
          playSound("flip");
          return true;
        }
        const won = next.status === "won";
        if (won) playSound("win");
        else playSound("lose");
        recordEndless(won, next.attemptsUsed);
        if (won) {
          recordGameEvent({ kind: "lingo-won", attempts: next.attemptsUsed, mode: "endless" });
        }
        setState({
          ...state,
          round: next,
          streak: won ? state.streak + 1 : 0,
          bestStreak: won ? Math.max(state.bestStreak, state.streak + 1) : state.bestStreak,
        });
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
            if (c === 0) return { letter: round.firstLetter, status: "empty" as const, state: "hint" as const };
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
  }, [round, buffer, shakeTick]);

  const evidence = useMemo(
    () => (round ? keyboardEvidence(round.guesses, round.results) : {}),
    [round],
  );

  if (!state || !round) return <div className="h-80 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-4 text-sm font-semibold text-stone-500 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <InfinityIcon className="size-4" aria-hidden />
          Neierobežoti vārdi
        </span>
        <span aria-live="polite">Sērija: {state.streak} · Rekords: {state.bestStreak}</span>
      </div>
      <LingoBoard rows={rows} palette={palette} />
      <div className="mt-5">
        <Keyboard
          palette={palette}
          evidence={evidence}
          disabled={!!finished}
          onKey={(key) => {
            if (key === "enter") submit();
            else if (key === "back") backspace();
            else append(key);
          }}
        />
      </div>
      {finished ? (
        <div className="mx-auto mt-5 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-sm font-semibold" aria-live="polite">
            {round.status === "won"
              ? `Vārds “${round.target.toUpperCase()}” atminēts ar ${round.attemptsUsed}. mēģinājumu!`
              : `Vārds bija “${round.target.toUpperCase()}”`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => {
                playSound("start");
                setState((s) => (s ? newWord(s) : s));
              }}
            >
              Nākamais vārds <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const target = pickTarget();
                setState({
                  round: createRound(target, "endless"),
                  recent: [target],
                  streak: 0,
                  bestStreak: state.bestStreak,
                });
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Restartēt sēriju
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
