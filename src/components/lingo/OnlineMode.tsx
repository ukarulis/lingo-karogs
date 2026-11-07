"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Flag,
  Link as LinkIcon,
  LogOut,
  Swords,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { LingoBoard, type BoardRow } from "./LingoBoard";
import { Keyboard } from "./Keyboard";
import { useGuessInput } from "./use-guess-input";
import type { CellStatus } from "@/lib/lingo/engine";
import { enabledLengths } from "@/lib/lingo/pools";
import { latvianPack } from "@/lib/lingo/pack/latvian";
import { paletteFor } from "@/lib/lingo/colors";
import {
  type LingoMpSession,
  apiCreateLingoMatch,
  apiJoinLingoMatch,
  apiJoinLingoMatchWithToken,
  apiLingoMpAction,
  apiLingoMpStatus,
  apiLingoMpView,
  getLingoMpSession,
  lastLingoMpSession,
  saveLingoMpSession,
} from "@/lib/lingo-mp/client";
import type { LingoMpView } from "@/lib/lingo-mp/types";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { useSettings } from "@/lib/use-settings";
import { cn } from "@/lib/utils";
import { WordInfoCard } from "./WordInfoCard";

const LENGTHS = enabledLengths();
const DEFAULT_LENGTH = LENGTHS.includes(5) ? "5" : String(LENGTHS[0] ?? 5);

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CopyInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/lingo?room=${code}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="rounded-lg bg-stone-100 px-3 py-2 font-mono text-lg font-black tracking-[0.25em] dark:bg-stone-800">
        {code}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {copied ? "Nokopēts!" : "Kopēt saiti"}
      </Button>
    </div>
  );
}

function fixedForRound(view: LingoMpView): (string | null)[] {
  const round = view.currentRound;
  if (!round) return [];
  const length = view.length;
  const fixed: (string | null)[] = new Array(length).fill(null);
  if (round.firstLetter) fixed[0] = round.firstLetter;
  const last = round.yourGuesses[round.yourGuesses.length - 1];
  if (last && round.yourOutcome === "playing") {
    last.result.forEach((cell, i) => {
      if (cell === "correct") fixed[i] = last.word[i];
    });
  }
  return fixed;
}

function guessLandedIn(view: LingoMpView, word: string): boolean {
  return (
    (view.currentRound?.yourGuesses ?? []).some((g) => g.word === word) ||
    view.resolvedRounds.some((round) =>
      round.yourGuesses.some((g) => g.word === word),
    )
  );
}

export function OnlineMode({
  palette,
}: {
  palette: ReturnType<typeof paletteFor>;
}) {
  const [settings] = useSettings();
  const { push } = useToast();
  const [format, setFormat] = useState<"quick-duel" | "five-word-battle">(
    "quick-duel",
  );
  const [lengthChoice, setLengthChoice] = useState<string>(DEFAULT_LENGTH);
  const [nickname, setNickname] = useState(settings.nickname);
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<LingoMpSession | null>(null);
  const [view, setView] = useState<LingoMpView | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const pendingGuessRef = useRef<{ actionId: string; word: string } | null>(
    null,
  );

  const now = useCallback(() => Date.now() + clockOffset, [clockOffset]);

  const poll = useCallback(async () => {
    if (!session) return;
    try {
      const next = await apiLingoMpView(session.matchId, session.playerToken);
      if (!mountedRef.current) return;
      setView(next);
      setClockOffset(Date.parse(next.serverNow) - Date.now());
    } catch {
      // Transient polling failures keep the last authoritative state.
    }
  }, [session]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Deep link or saved-session recovery on mount.
  useEffect(() => {
    // The invitation room parameter is applied synchronously so a guest can
    // join immediately; the availability probe is independent of it.
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setJoinCode(room);
    const last = lastLingoMpSession();
    if (last) {
      const saved = getLingoMpSession(last.matchId);
      if (saved && (!room || saved.code === room)) setSession(saved);
    }
    void apiLingoMpStatus().then(setAvailable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling cadence: faster during countdown/play, slower otherwise.
  useEffect(() => {
    if (!session) return;
    void poll();
    const fast =
      !!view &&
      (view.status === "waiting" ||
        view.status === "ready" ||
        view.status === "countdown" ||
        view.status === "playing");
    const interval = window.setInterval(
      () => void poll(),
      fast ? 1200 : 3000,
    );
    const onFocus = () => void poll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, view?.status]);

  // Local countdown ticker.
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  const createRoom = async () => {
    setBusy(true);
    try {
      const nick = (nickname.trim() || settings.nickname.trim() || "Spēlētājs").slice(0, 20);
      const created = await apiCreateLingoMatch(
        format,
        Number(lengthChoice),
        nick,
      );
      const s: LingoMpSession = {
        matchId: created.matchId,
        code: created.code,
        playerToken: created.playerToken,
        slot: "host",
        nickname: nick,
      };
      saveLingoMpSession(s);
      setSession(s);
      const initial = await apiLingoMpView(created.matchId, created.playerToken);
      setView(initial);
      setClockOffset(Date.parse(initial.serverNow) - Date.now());
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Neizdevās izveidot istabu",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (code?: string, existingToken?: string) => {
    setBusy(true);
    try {
      const room = (code ?? joinCode).trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(room)) {
        push("Istabas kodam jābūt 6 zīmēm", "error");
        return;
      }
      const nick = (nickname.trim() || settings.nickname.trim() || "Spēlētājs").slice(0, 20);
      const joined = existingToken
        ? await apiJoinLingoMatchWithToken(room, nick, existingToken)
        : await apiJoinLingoMatch(room, nick);
      const s: LingoMpSession = {
        matchId: joined.matchId,
        code: joined.code,
        playerToken: joined.playerToken,
        slot: joined.slot,
        nickname: nick,
      };
      saveLingoMpSession(s);
      setSession(s);
      const initial = await apiLingoMpView(joined.matchId, joined.playerToken);
      setView(initial);
      setClockOffset(Date.parse(initial.serverNow) - Date.now());
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Neizdevās pievienoties",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const send = async (
    type: "ready" | "guess" | "extend" | "forfeit" | "cancel" | "rematch" | "leave",
    word?: string,
  ): Promise<LingoMpView | null> => {
    if (!session) return null;
    const res = await apiLingoMpAction(session.matchId, session.playerToken, {
      actionId: crypto.randomUUID(),
      type,
      payload: word ? { word } : undefined,
    });
    if (!res.ok) {
      push(res.error ?? "Darbība neizdevās", "error");
      return null;
    }
    if (type === "extend") push("+15 sekundes", "success");
    if (res.view) {
      setView(res.view);
      setClockOffset(Date.parse(res.view.serverNow) - Date.now());
    }
    return res.view ?? null;
  };

  const submitGuess = (word: string): boolean => {
    if (!session || submittingRef.current) return false;
    // A lost response is retried with the same action ID so the server can
    // never apply the same guess twice.
    const actionId =
      pendingGuessRef.current?.word === word
        ? pendingGuessRef.current.actionId
        : crypto.randomUUID();
    pendingGuessRef.current = { actionId, word };
    submittingRef.current = true;
    setSubmitting(true);
    void (async () => {
      let accepted = false;
      try {
        const res = await apiLingoMpAction(session.matchId, session.playerToken, {
          actionId,
          type: "guess",
          payload: { word },
        });
        if (res.ok && res.view) {
          setView(res.view);
          setClockOffset(Date.parse(res.view.serverNow) - Date.now());
          accepted = guessLandedIn(res.view, word);
          if (accepted) {
            pendingGuessRef.current = null;
            // Only clear letters that still hold the accepted word; a late
            // response must never wipe input typed for the next round.
            if (buffer.join("") === word || buffer.every((c) => c === null)) {
              reset();
            }
            playSound(
              res.view.currentRound?.yourOutcome === "solved" ? "win" : "flip",
            );
          } else {
            pendingGuessRef.current = null;
            push(res.error ?? "Minējums netika pieņemts", "error");
          }
        } else {
          pendingGuessRef.current = null;
          push(res.error ?? "Minējums netika pieņemts", "error");
        }
      } catch {
        // Network failure: the pending action ID is kept so a retry of the
        // same word reuses it; polling reconciles the true state.
        void poll();
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    })();
    return false;
  };

  const fixed = useMemo(() => (view ? fixedForRound(view) : []), [view]);
  const { buffer, shakeTick, append, backspace, submit, reset } = useGuessInput({
    enabled:
      !!view &&
      view.status === "playing" &&
      view.currentRound?.status === "active" &&
      view.currentRound.yourOutcome === "playing",
    fixedPositions: fixed,
    length: view?.length ?? 5,
    pack: latvianPack,
    onSubmit: submitGuess,
  });

  const rows: BoardRow[] = useMemo(() => {
    const round = view?.currentRound;
    if (!round || !view) return [];
    const maxAttempts = view.maxAttempts;
    const length = view.length;
    return Array.from({ length: maxAttempts }, (_, r) => {
      if (r < round.yourGuesses.length) {
        const guess = round.yourGuesses[r];
        return {
          state: "done" as const,
          cells: guess.word.split("").map((letter, c) => ({
            letter,
            status: guess.result[c],
            state: "done" as const,
          })),
        };
      }
      if (r === round.yourGuesses.length && round.yourOutcome === "playing") {
        return {
          state: "current" as const,
          shake: shakeTick > 0,
          cells: Array.from({ length }, (_, c) => {
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
        cells: Array.from({ length }, () => ({
          letter: null,
          status: "empty" as const,
          state: "idle" as const,
        })),
      };
    });
  }, [view, buffer, fixed, shakeTick]);

  const evidence = useMemo(() => {
    const out: Record<string, CellStatus> = {};
    const strength: Record<CellStatus, number> = {
      correct: 3,
      present: 2,
      absent: 1,
    };
    for (const guess of view?.currentRound?.yourGuesses ?? []) {
      guess.word.split("").forEach((ch, i) => {
        const st = guess.result[i];
        if (!out[ch] || strength[st] > strength[out[ch]]) out[ch] = st;
      });
    }
    return out;
  }, [view]);

  // Reconcile after a lost response: if the pending word now appears in the
  // authoritative guess history, the submission actually landed.
  useEffect(() => {
    const pending = pendingGuessRef.current;
    if (!pending || !view) return;
    const landed = guessLandedIn(view, pending.word);
    if (landed) {
      pendingGuessRef.current = null;
      setSubmitting(false);
      submittingRef.current = false;
      if (
        buffer.join("") === pending.word ||
        buffer.every((c) => c === null)
      ) {
        reset();
      }
    }
  }, [view, reset, buffer]);

  // ---- form state ----
  if (!session) {
    if (available === false) {
      return (
        <Card className="mx-auto max-w-lg p-6 text-center">
          <h2 className="flex items-center justify-center gap-2 text-lg font-extrabold">
            <Swords className="size-5 text-indigo-500" aria-hidden />
            Spēlēt ar draugu
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Tiešsaistes spēle pašlaik nav pieejama — servera infrastruktūra vēl
            nav pieslēgta. Viena ierīce: izmēģini Neierobežoto vai Klasisko
            Lingo.
          </p>
        </Card>
      );
    }
    return (
      <Card className="mx-auto max-w-lg p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Swords className="size-5 text-indigo-500" aria-hidden />
          Spēlēt ar draugu
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Izveido privātu istabu un uzaicini draugu ar saiti vai kodu.
        </p>
        <div className="mt-4">
          <Segmented
            ariaLabel="Spēles formāts"
            value={format}
            onChange={setFormat}
            options={[
              { value: "quick-duel", label: "Ātrais duelis" },
              { value: "five-word-battle", label: "Piecu vārdu cīņa" },
            ]}
          />
        </div>
        <div className="mt-3">
          <Segmented
            ariaLabel="Vārda garums"
            value={lengthChoice}
            onChange={setLengthChoice}
            options={LENGTHS.map((len) => ({
              value: String(len),
              label: `${len} burti`,
            }))}
          />
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
            Segvārds
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            placeholder="Spēlētājs"
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
          />
        </label>
        <Button className="mt-4 w-full" disabled={busy} onClick={() => void createRoom()}>
          <Swords className="size-4" aria-hidden />
          Izveidot istabu
        </Button>
        <div className="mt-5 border-t border-stone-200 pt-4 dark:border-stone-800">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
            Vai pievienojies ar istabas kodu
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6),
                )
              }
              placeholder="ABC123"
              aria-label="Istabas kods"
              className="w-32 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-center font-mono text-sm font-black uppercase tracking-[0.2em] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
            />
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => void joinRoom()}
            >
              <LinkIcon className="size-4" aria-hidden />
              Pievienoties
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!view) {
    return (
      <div className="h-64 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />
    );
  }

  const myPlayer = view.players.find((p) => p.slot === view.you.slot);
  const opponent = view.players.find((p) => p.slot !== view.you.slot);
  const round = view.currentRound;
  const myDeadline = round?.yourDeadline ? Date.parse(round.yourDeadline) : null;
  const remaining = myDeadline ? myDeadline - now() : null;

  const lobby = view.status === "waiting" || view.status === "ready";
  const countdown = view.status === "countdown";
  const playing = view.status === "playing";
  const finished =
    view.status === "finished" ||
    view.status === "cancelled" ||
    view.status === "expired" ||
    view.status === "forfeited";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card className="p-3 text-center">
          <div className="text-xs font-bold text-stone-400">Tu</div>
          <div className="truncate text-sm font-extrabold">
            {myPlayer?.nickname ?? "Spēlētājs"}
          </div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {myPlayer?.totalScore ?? 0} punkti · {myPlayer?.wordsSolved ?? 0} vārdi
          </div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs font-bold text-stone-400">
            {playing ? `Kārta ${view.roundIndex + 1}/${view.totalRounds}` : "Istaba"}
          </div>
          <div className="text-sm font-extrabold">
            {view.format === "quick-duel" ? "Ātrais duelis" : "Piecu vārdu cīņa"}
          </div>
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {view.length} burti · {view.timePerWordSec}s
          </div>
        </Card>
        <Card className="col-span-2 p-3 text-center sm:col-span-1">
          <div className="text-xs font-bold text-stone-400">Pretinieks</div>
          <div className="truncate text-sm font-extrabold">
            {opponent?.nickname ?? "Gaida..."}
          </div>
          <div className="text-xs font-semibold text-red-500 dark:text-red-400">
            {opponent?.totalScore ?? 0} punkti · {opponent?.wordsSolved ?? 0} vārdi
          </div>
        </Card>
      </div>

      {lobby ? (
        <Card className="p-6 text-center">
          <h3 className="flex items-center justify-center gap-2 text-lg font-extrabold">
            <Users className="size-5 text-indigo-500" aria-hidden />
            Spēlētāji
          </h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Nosūti draugam šo saiti vai kodu.
          </p>
          <div className="mt-3">
            <CopyInvite code={view.code} />
          </div>
          <div className="mt-4 space-y-2">
            {view.players.map((p) => (
              <div
                key={p.slot}
                className="flex items-center justify-between rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-bold dark:bg-stone-800"
              >
                <span>
                  {p.nickname ?? (p.slot === "host" ? "Īpašnieks" : "Viesis")}
                </span>
                <span className={p.ready ? "text-emerald-600" : "text-amber-600"}>
                  {p.connected
                    ? p.ready
                      ? "Gatavs"
                      : "Nav gatavs"
                    : "Nav pievienojies"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!myPlayer?.ready ? (
              <Button onClick={() => void send("ready")}>
                <Check className="size-4" aria-hidden />
                Esmu gatavs
              </Button>
            ) : (
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Gaidi pretinieku…
              </p>
            )}
            {view.you.slot === "host" ? (
              <Button variant="secondary" onClick={() => void send("cancel")}>
                Atcelt istabu
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => void send("leave")}>
                <LogOut className="size-4" aria-hidden />
                Pamest istabu
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      {countdown ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-bold text-stone-500 dark:text-stone-400">
            Spēle sākas pēc
          </p>
          <p className="mt-2 text-5xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
            {view.countdownEndsAt
              ? Math.max(
                  1,
                  Math.ceil((Date.parse(view.countdownEndsAt) - now()) / 1000),
                )
              : "…"}
          </p>
        </Card>
      ) : null}

      {playing && round ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-stone-600 dark:text-stone-300">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 tabular-nums",
                myDeadline &&
                  remaining !== null &&
                  remaining <= 15_000 &&
                  round.yourOutcome === "playing"
                  ? "font-black text-red-600 dark:text-red-400"
                  : "",
              )}
            >
              <Timer className="size-4" aria-hidden />
              {myDeadline && remaining !== null ? fmtTime(remaining) : "…"}
            </span>
            {submitting ? (
              <span className="animate-pulse text-xs font-bold text-indigo-500">
                Iesniedz…
              </span>
            ) : null}
            {view.extensionsPerMatch > 0 ? (
              <button
                onClick={() => void send("extend")}
                disabled={
                  !(round.status === "active" && round.yourOutcome === "playing") ||
                  (myPlayer?.extensionsLeft ?? 0) <= 0 ||
                  round.yourExtensionsUsedThisRound >= 1
                }
                className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-40 dark:bg-amber-950 dark:text-amber-300"
              >
                Pagarināt +15 s ({myPlayer?.extensionsLeft ?? 0}/
                {view.extensionsPerMatch})
              </button>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Flag className="size-4" aria-hidden />
              Pretinieks: {opponent?.wordsSolved ?? 0} vārdi ·{" "}
              {round.players.find((p) => p.slot !== view.you.slot)?.attemptsUsed ??
                0}{" "}
              mēģinājumi
            </span>
          </div>
          {round.yourOutcome === "solved" && round.status === "active" ? (
            <p className="mb-3 animate-pulse text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Vārds atminēts — gaidi pretinieku…
            </p>
          ) : null}
          {round.status === "pending" ? (
            <Card className="p-6 text-center">
              <p className="text-sm font-bold text-stone-500 dark:text-stone-400">
                {round.word
                  ? `Vārds: ${round.word.toUpperCase()}`
                  : "Nākamā kārta sākas drīz…"}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                {round.nextStartAt
                  ? Math.max(
                      0,
                      Math.ceil((Date.parse(round.nextStartAt) - now()) / 1000),
                    )
                  : "…"}
              </p>
            </Card>
          ) : null}
          <LingoBoard rows={rows} palette={palette} />
          <div className="mt-5">
            <Keyboard
              palette={palette}
              evidence={evidence}
              disabled={
                !(
                  round.status === "active" &&
                  round.yourOutcome === "playing" &&
                  view.status === "playing"
                )
              }
              layout={latvianPack.keyboardLayout}
              onKey={(key) => {
                if (key === "enter") submit();
                else if (key === "back") backspace();
                else append(key);
              }}
            />
          </div>
          {round.status === "resolved" && round.word ? (
            <>
              <Card className="mx-auto mt-4 max-w-sm p-4 text-center">
                <p className="text-sm font-bold">
                  Vārds bija {round.word.toUpperCase()} —{" "}
                  {round.yourOutcome === "solved"
                    ? "atminēji!"
                    : round.yourOutcome === "timeout"
                      ? "laiks beidzās"
                      : "neatminēji"}
                </p>
                <div className="mt-2 flex justify-around text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {round.players.map((p) => (
                    <span key={p.slot}>
                      {p.nickname}: {p.attemptsUsed} mēģ. · {p.score} p
                    </span>
                  ))}
                </div>
              </Card>
              <WordInfoCard word={round.word} compact />
            </>
          ) : null}
          <div className="mx-auto mt-3 flex max-w-sm justify-center">
            <Button variant="ghost" size="sm" onClick={() => void send("forfeit")}>
              <LogOut className="size-4" aria-hidden />
              Pārtraukt spēli
            </Button>
          </div>
        </div>
      ) : null}

      {finished ? (
        <Card className="p-6 text-center">
          <h3 className="flex items-center justify-center gap-2 text-xl font-extrabold">
            <Trophy className="size-6 text-amber-500" aria-hidden />
            {view.result?.winner === "draw"
              ? "Neizšķirts"
              : view.result?.winner === view.you.slot
                ? "Tu uzvarēji!"
                : "Pretinieks uzvarēja"}
          </h3>
          {view.result ? (
            <div className="mt-3 flex justify-center gap-6 text-sm font-bold">
              <span>
                {view.result.host.score} p · {view.result.host.solved} vārdi
              </span>
              <span className="text-stone-400">—</span>
              <span>
                {view.result.guest.score} p · {view.result.guest.solved} vārdi
              </span>
            </div>
          ) : null}
          {view.result && view.result.rounds.length > 0 ? (
            <div className="mx-auto mt-4 max-w-md overflow-x-auto rounded-xl border border-stone-200 text-left text-sm dark:border-stone-800">
              <table className="w-full">
                <caption className="sr-only">Raundu rezultāti</caption>
                <tbody>
                  {view.result.rounds.map((r) => (
                    <tr
                      key={r.index}
                      className="border-b border-stone-100 last:border-0 dark:border-stone-800/60"
                    >
                      <td className="px-3 py-2 font-mono font-bold uppercase">
                        {r.word}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.host.attemptsUsed} · {r.host.score}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.guest.attemptsUsed} · {r.guest.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {view.result && view.result.rounds.length > 0 ? (
            <WordInfoCard
              word={view.result.rounds[view.result.rounds.length - 1].word}
              compact
            />
          ) : null}
          {view.status === "cancelled" || view.status === "expired" ? (
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              Spēle tika pārtraukta.
            </p>
          ) : null}
          {view.status === "forfeited" ? (
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              Kāds no spēlētājiem pārtrauca spēli.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {view.rematch.newCode ? (
              <Button
                onClick={() =>
                  void joinRoom(view.rematch.newCode ?? undefined, session.playerToken)
                }
              >
                Turpināt uz revanšu
              </Button>
            ) : (
              <Button
                disabled={view.rematch.requestedByMe}
                onClick={() => void send("rematch")}
              >
                {view.rematch.requestedByMe
                  ? view.rematch.requestedByOpponent
                    ? "Revanšs izveidots"
                    : "Gaida pretinieku…"
                  : "Revanšs"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setSession(null);
                setView(null);
              }}
            >
              Atpakaļ uz izvēlni
            </Button>
          </div>
        </Card>
      ) : null}

      {lobby ? (
        <p className="mt-3 text-center text-xs text-stone-400 dark:text-stone-500">
          <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
          Tikai aicinātie spēlētāji redz šo istabu.
        </p>
      ) : null}
    </div>
  );
}
