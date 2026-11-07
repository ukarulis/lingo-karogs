"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Infinity as InfinityIcon,
  RotateCcw,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { LingoBoard, type BoardRow } from "./LingoBoard";
import { Keyboard } from "./Keyboard";
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
  enabledLengths,
  getGuessSet,
  loadPool,
  pickTargetFrom,
  type WordPool,
} from "@/lib/lingo/pools";
import { latvianPack } from "@/lib/lingo/pack/latvian";
import { paletteFor } from "@/lib/lingo/colors";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { recordEndless } from "@/lib/store/lingoStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { loadGame, saveGame, storageRemove } from "@/lib/store/storage";
import { WordInfoCard } from "./WordInfoCard";
import { loadBeginnerWords } from "@/lib/lingo/content";

type LengthChoice = string; // "4" | "5" | "6" | "7" | "random"

interface EndlessState {
  /** Which localStorage slot this game belongs to. */
  sessionKey: string;
  round: LingoRound;
  /** Recently used targets for the active fixed length. */
  recent: string[];
  /** Per-length recent words, used by the random mode. */
  recentByLength: Record<number, string[]>;
  streak: number;
  bestStreak: number;
  lastRandomLength: number | null;
  /** Casual beginner-friendly pool toggle (does not change official rules). */
  beginner: boolean;
}

const LENGTHS = enabledLengths();
const DEFAULT_LENGTH = LENGTHS.includes(5) ? 5 : (LENGTHS[0] ?? 5);
const RECENT_CAP = 30;

function e2eParams(): URLSearchParams | null {
  if (!process.env.NEXT_PUBLIC_E2E || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

function initialChoice(): LengthChoice {
  const params = e2eParams();
  const forced = params?.get("endlesslen");
  if (
    forced &&
    (LENGTHS.map(String).includes(forced) || forced === "random")
  ) {
    return forced;
  }
  return String(DEFAULT_LENGTH);
}

function keyFor(choice: LengthChoice): string {
  return `lingoEndless:${latvianPack.id}:${choice}`;
}

const LEGACY_KEY = "lingoEndless";

function freshState(
  sessionKey: string,
  pool: WordPool,
  recentByLength: Record<number, string[]>,
  forcedTarget: string | null = null,
): EndlessState {
  const recent = recentByLength[pool.length] ?? [];
  const target =
    forcedTarget ?? pickTargetFrom(pool, Math.random, new Set(recent));
  return {
    sessionKey,
    round: createRound(target, "endless", {
      pack: latvianPack,
      length: pool.length,
    }),
    recent: [...recent, target].slice(-RECENT_CAP),
    recentByLength,
    streak: 0,
    bestStreak: 0,
    lastRandomLength: null,
    beginner: false,
  };
}

function forcedTarget(pool: WordPool | null): string | null {
  const params = e2eParams();
  const raw = params?.get("endlessword");
  if (!raw || !pool) return null;
  const normalized = latvianPack.normalizeInput(raw);
  if (
    latvianPack.segmentWord(normalized).length === pool.length &&
    latvianPack.validateCharacters(normalized)
  ) {
    return normalized;
  }
  return null;
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

async function loadChoice(choice: LengthChoice): Promise<EndlessState | null> {
  const key = keyFor(choice);
  let stored = loadGame<EndlessState>(key, isEndlessState)?.data ?? null;
  if (!stored && choice === String(DEFAULT_LENGTH)) {
    // One-time migration of the historical five-letter unlimited save.
    stored = loadGame<EndlessState>(LEGACY_KEY, isEndlessState)?.data ?? null;
    if (stored) {
      const migrated = { ...stored, sessionKey: key };
      saveGame(key, migrated, migrated.round.status);
      storageRemove(LEGACY_KEY);
    }
  }
  if (stored) {
    const round = normalizeRound(stored.round);
    if (!round) return null;
    return {
      ...stored,
      sessionKey: key,
      round,
      recentByLength: stored.recentByLength ?? {},
      lastRandomLength: stored.lastRandomLength ?? null,
      beginner: stored.beginner ?? false,
    };
  }
  if (choice === "random") {
    const pool = await loadPool(DEFAULT_LENGTH);
    if (!pool) return null;
    return freshState(key, pool, {}, forcedTarget(pool));
  }
  const pool = await loadPool(Number(choice));
  if (!pool) return null;
  return freshState(key, pool, {}, forcedTarget(pool));
}

async function nextRandomWord(
  state: EndlessState,
  beginnerWords: ReadonlySet<string> | null,
): Promise<EndlessState> {
  const choices = LENGTHS.filter((l) => l !== state.round.length);
  const poolChoices = choices.length > 0 ? choices : LENGTHS;
  const length =
    poolChoices[Math.floor(Math.random() * poolChoices.length)] ?? DEFAULT_LENGTH;
  const pool = await loadPool(length);
  if (!pool) return state;
  const recent = state.recentByLength[length] ?? [];
  const target = pickTargetFrom(
    beginnerPool(pool, state.beginner, beginnerWords),
    Math.random,
    new Set(recent),
  );
  return {
    ...state,
    round: createRound(target, "endless", { pack: latvianPack, length }),
    recent,
    recentByLength: {
      ...state.recentByLength,
      [length]: [...recent, target].slice(-RECENT_CAP),
    },
    lastRandomLength: length,
  };
}

function beginnerPool(
  pool: WordPool,
  beginner: boolean,
  beginnerWords: ReadonlySet<string> | null,
): WordPool {
  if (!beginner || !beginnerWords) return pool;
  const filtered = pool.targets.filter((w) => beginnerWords.has(w));
  return filtered.length > 0 ? { ...pool, targets: filtered } : pool;
}

function nextFixedWord(
  state: EndlessState,
  pool: WordPool,
  beginnerWords: ReadonlySet<string> | null,
): EndlessState {
  const target = pickTargetFrom(
    beginnerPool(pool, state.beginner, beginnerWords),
    Math.random,
    new Set(state.recent),
  );
  return {
    ...state,
    round: createRound(target, "endless", {
      pack: latvianPack,
      length: pool.length,
    }),
    recent: [...state.recent, target].slice(-RECENT_CAP),
    recentByLength: {
      ...state.recentByLength,
      [pool.length]: [...(state.recentByLength[pool.length] ?? []), target].slice(
        -RECENT_CAP,
      ),
    },
    lastRandomLength: null,
  };
}

export function EndlessMode({
  palette,
}: {
  palette: ReturnType<typeof paletteFor>;
}) {
  const [choice, setChoice] = useState<LengthChoice>(initialChoice);
  const [pool, setPool] = useState<WordPool | null>(null);
  const [state, setState] = useState<EndlessState | null>(null);
  const [guessSet, setGuessSet] = useState<ReadonlySet<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [beginnerWords, setBeginnerWords] = useState<ReadonlySet<string> | null>(
    null,
  );
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    void loadBeginnerWords().then((set) => {
      if (!cancelled) setBeginnerWords(set);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const loaded = await loadChoice(choice);
      if (cancelled) return;
      setState(loaded);
      if (loaded) {
        const nextPool =
          choice === "random" ? await loadPool(loaded.round.length) : await loadPool(Number(choice));
        const set = await getGuessSet(loaded.round.length);
        if (cancelled) return;
        setPool(nextPool);
        setGuessSet(set);
      } else {
        setPool(null);
        setGuessSet(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [choice]);

  useEffect(() => {
    if (state) {
      saveGame(state.sessionKey, state, state.round.status);
    }
  }, [state]);

  const round = state?.round ?? null;
  const finished = round != null && round.status !== "playing";

  const fixed = useMemo(() => (round ? fixedLetters(round) : []), [round]);

  const { buffer, shakeTick, append, backspace, submit } = useGuessInput({
    enabled: !!round && round.status === "playing",
    fixedPositions: fixed,
    length: round?.length ?? 5,
    pack: latvianPack,
    onSubmit: (word) => {
      if (!round || !state) return false;
      try {
        const next = submitGuess(round, word, guessSet ?? new Set());
        if (next.status === "playing") {
          setState({ ...state, round: next });
          playSound("flip");
          return true;
        }
        const won = next.status === "won";
        if (won) playSound("win");
        else playSound("lose");
        recordEndless(
          won,
          next.attemptsUsed,
          round.length,
          latvianPack.id,
          round.maxAttempts,
        );
        if (won) {
          recordGameEvent({
            kind: "lingo-won",
            attempts: next.attemptsUsed,
            mode: "endless",
          });
        }
        setState({
          ...state,
          round: next,
          streak: won ? state.streak + 1 : 0,
          bestStreak: won
            ? Math.max(state.bestStreak, state.streak + 1)
            : state.bestStreak,
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
              return {
                letter: fixed[c],
                status: "empty" as const,
                state: "hint" as const,
              };
            }
            return {
              letter: buffer[c] ?? null,
              status: "empty" as const,
              state: buffer[c] ? ("typed" as const) : ("idle" as const),
            };
          }),
        };
      }
      return {
        state: "empty" as const,
        cells: Array.from({ length: round.length }, () => ({
          letter: null,
          status: "empty" as const,
          state: "idle" as const,
        })),
      };
    });
  }, [round, buffer, fixed, shakeTick]);

  const evidence = useMemo(
    () => (round ? keyboardEvidence(round.guesses, round.results) : {}),
    [round],
  );

  const startNext = async () => {
    if (!state) return;
    playSound("start");
    if (choice === "random") {
      const next = await nextRandomWord(state, beginnerWords);
      const nextPool = await loadPool(next.round.length);
      setPool(nextPool);
      setGuessSet(await getGuessSet(next.round.length));
      setState(next);
      return;
    }
    if (pool) setState(nextFixedWord(state, pool, beginnerWords));
  };

  const restartSeries = async () => {
    if (!state) return;
    playSound("start");
    if (choice === "random") {
      const base = await loadPool(DEFAULT_LENGTH);
      if (base) {
        setPool(base);
        setGuessSet(await getGuessSet(base.length));
        setState(freshState(state.sessionKey, base, state.recentByLength));
      }
      return;
    }
    if (pool) {
      setState(
        freshState(state.sessionKey, pool, {
          ...state.recentByLength,
          [pool.length]: state.recent,
        }),
      );
    }
  };

  if (!state || !round || loading) {
    return (
      <div className="h-80 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />
    );
  }

  const lengthLabel =
    choice === "random" ? `${round.length} burti` : `${choice} burti`;

  return (
    <div>
      <div className="mb-3 flex justify-center">
        <Segmented<LengthChoice>
          ariaLabel="Vārda garums"
          value={choice}
          onChange={setChoice}
          options={[
            ...LENGTHS.map((len) => ({
              value: String(len),
              label: `${len} burti`,
            })),
            { value: "random", label: "Nejauši" },
          ]}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <InfinityIcon className="size-4" aria-hidden />
          Neierobežoti vārdi · {lengthLabel}
        </span>
        {choice === "random" ? (
          <span className="inline-flex items-center gap-1.5">
            <Shuffle className="size-4" aria-hidden />
            Garums mainās katrā kārtā
          </span>
        ) : null}
        <span aria-live="polite">
          Sērija: {state.streak} · Rekords: {state.bestStreak}
        </span>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <input
            type="checkbox"
            checked={state.beginner}
            onChange={(e) =>
              setState((s) => (s ? { ...s, beginner: e.target.checked } : s))
            }
            className="size-3.5 accent-emerald-600"
          />
          Viegli vārdi
        </label>
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
      {finished ? (
        <div className="mx-auto mt-5 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-sm font-semibold" aria-live="polite">
            {round.status === "won"
              ? `Vārds “${round.target.toUpperCase()}” atminēts ar ${round.attemptsUsed}. mēģinājumu!`
              : `Vārds bija “${round.target.toUpperCase()}”`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void startNext()}>
              Nākamais vārds <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button variant="secondary" onClick={() => void restartSeries()}>
              <RotateCcw className="size-4" aria-hidden />
              Restartēt sēriju
            </Button>
          </div>
          <WordInfoCard word={round.target} />
        </div>
      ) : null}
    </div>
  );
}
