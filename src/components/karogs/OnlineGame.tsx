"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  LogOut,
  Shield,
  Swords,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KarogsBoard } from "./KarogsBoard";
import { MoveLog } from "./MoveLog";
import { SetupPanel, useSetupController } from "./SetupPanel";
import {
  type Piece,
  emptyBoard,
  legalMovesForCells,
} from "@/lib/karogs/engine";
import { applyFormation, formationById } from "@/lib/karogs/formations";
import {
  type PlayerActionType,
  type StateView,
} from "@/lib/multiplayer/types";
import {
  apiAction,
  apiCreateRoom,
  apiJoinRoom,
  apiJoinWithToken,
  apiView,
} from "@/lib/multiplayer/client";
import {
  type OnlineSession,
  loadOnlineSessions,
  saveOnlineSession,
} from "@/lib/store/online";
import { storageRemove } from "@/lib/store/storage";
import { useSettings } from "@/lib/use-settings";
import { useToast } from "@/lib/toast";
import { playSound } from "@/lib/sound";
import { recordKarogsGame } from "@/lib/store/karogsStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { endLabel, reasonLabel } from "./ResultPanel";

export function OnlineGame({ initialCode }: { initialCode?: string }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [view, setView] = useState<StateView | null>(null);
  const [nickname, setNickname] = useState("");
  const [codeInput, setCodeInput] = useState(initialCode ?? "");
  const [placement, setPlacement] = useState<Record<number, Piece>>(() => {
    const formation = formationById("balanced");
    return formation ? applyFormation(formation, "red", Math.random) : {};
  });
  const [onlineDisabled, setOnlineDisabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [destinations, setDestinations] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [online, setOnline] = useState(true);
  const [recorded, setRecorded] = useState(false);
  const { push } = useToast();
  const [settings] = useSettings();

  const sessionRef = useCallback((s: OnlineSession) => {
    saveOnlineSession(s);
    setSession(s);
    setView(null);
    setPlacement({});
    setRecorded(false);
  }, []);

  useEffect(() => {
    if (initialCode) {
      const all = loadOnlineSessions();
      const found = Object.values(all).find(
        (s) => s.code === initialCode.trim().toUpperCase(),
      );
      if (found) setSession(found);
    }
  }, [initialCode]);

  useEffect(() => {
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  // Poll for state.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const v = await apiView(session.gameId, session.playerToken);
        if (!cancelled) {
          setView(v);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Savienojuma kļūda");
        }
      }
    };
    void tick();
    const iv = window.setInterval(tick, view?.status === "playing" ? 1300 : 2400);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.gameId, view?.status]);

  useEffect(() => {
    if (
      view?.status === "setup" &&
      view.yourSetup &&
      Object.keys(view.yourSetup).length > 0
    ) {
      setPlacement(view.yourSetup);
    }
  }, [view?.status, view?.yourSetup]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setOnlineDisabled(h?.multiplayer?.mode !== "supabase"))
      .catch(() => undefined);
  }, []);

  const mySide = view?.yourSide ?? session?.side ?? null;
  const controller = useSetupController(mySide ?? "red", placement, setPlacement, {
    initialFormationId: "balanced",
  });

  const act = useCallback(
    async (
      type: PlayerActionType,
      payload: { placement?: Record<number, Piece>; pieceId?: string; to?: number } = {},
    ): Promise<boolean> => {
      if (!session || busy) return false;
      setBusy(true);
      try {
        const res = await apiAction(session.gameId, session.playerToken, {
          actionId: crypto.randomUUID(),
          type,
          payload,
        });
        if (res.ok && res.view) {
          setView(res.view);
          return true;
        }
        push(res.error ?? "Darbība neizdevās", "error");
        return false;
      } catch {
        push("Savienojuma kļūda", "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [session, busy, push],
  );

  const create = async () => {
    const nick = (nickname.trim() || settings.nickname.trim() || "Spēlētājs").slice(0, 20);
    try {
      const res = await apiCreateRoom(nick);
      sessionRef({
        gameId: res.gameId,
        code: res.code,
        playerToken: res.playerToken,
        side: "red",
        nickname: nick,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neizdevās izveidot istabu");
    }
  };

  const join = async () => {
    const nick = (nickname.trim() || settings.nickname.trim() || "Spēlētājs").slice(0, 20);
    try {
      const res = await apiJoinRoom(codeInput, nick);
      sessionRef({
        gameId: res.gameId,
        code: res.code,
        playerToken: res.playerToken,
        side: res.side,
        nickname: nick,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neizdevās pievienoties");
    }
  };

  const submitSetup = async () => {
    const ok = await act("deploy", { placement });
    if (ok) await act("ready");
  };

  const onCellClick = (idx: number) => {
    if (!view || !mySide || view.status !== "playing" || view.turn !== mySide || busy) return;
    const piece = view.board?.[idx];
    if (selected !== null && destinations.includes(idx)) {
      const src = view.board?.[selected];
      if (src && "hidden" in src === false && src.owner === mySide) {
        playSound("capture");
        void act("move", { pieceId: src.id, to: idx });
      }
      setSelected(null);
      setDestinations([]);
      return;
    }
    if (piece && piece.owner === mySide && !("hidden" in piece) && piece.kind === "movable") {
      const moves = legalMovesForCells(
        view.board ?? [],
        mySide,
        view.turn,
      ).filter((m) => m.pieceId === piece.id);
      if (moves.length > 0) {
        setSelected(idx);
        setDestinations(moves.map((m) => m.to));
      }
    }
  };

  const requestRematch = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const res = await apiAction(session.gameId, session.playerToken, {
        actionId: crypto.randomUUID(),
        type: "rematch",
        payload: {},
      });
      if (res.ok && res.view?.rematchCode) {
        const joined = await apiJoinWithToken(
          res.view.rematchCode,
          session.nickname,
          session.playerToken,
        );
        sessionRef({
          gameId: joined.gameId,
          code: joined.code,
          playerToken: session.playerToken,
          side: joined.side,
          nickname: session.nickname,
        });
      } else {
        push(res.error ?? "Revanšs neizdevās", "error");
      }
    } catch {
      push("Savienojuma kļūda", "error");
    } finally {
      setBusy(false);
    }
  };

  const acceptRematch = async () => {
    if (!session || !view?.rematchCode) return;
    try {
      const joined = await apiJoinWithToken(
        view.rematchCode,
        session.nickname,
        session.playerToken,
      );
      sessionRef({
        gameId: joined.gameId,
        code: joined.code,
        playerToken: session.playerToken,
        side: joined.side,
        nickname: session.nickname,
      });
    } catch (err) {
      push(err instanceof Error ? err.message : "Neizdevās pievienoties revanšam", "error");
    }
  };

  const leave = () => {
    if (session) storageRemove(`onlineSessions:${session.gameId}`);
    const all = loadOnlineSessions();
    delete all[session?.gameId ?? ""];
    localStorage.setItem("lk.onlineSessions", JSON.stringify(all));
    setSession(null);
    setView(null);
    setSelected(null);
    setDestinations([]);
  };

  // Record verified result locally when the match finishes.
  useEffect(() => {
    if (!view || view.status !== "finished" || recorded || !mySide) return;
    setRecorded(true);
    const result = view.winner === "draw" ? "draw" : view.winner === mySide ? "win" : "loss";
    recordKarogsGame({
      id: view.gameId,
      opponent: "online",
      result,
      moves: view.moves.length,
      durationSec: 0,
      flagCaptured: view.endReason === "flag-captured",
      spyKilledMarshal: view.moves.some(
        (m) => m.attackerRank === 1 && m.defenderRank === 10 && m.outcome === "attack",
      ),
      bombDefused: view.moves.some(
        (m) => m.defenderKind === "bomb" && m.outcome === "attack",
      ),
      date: new Date().toISOString(),
    });
    if (result === "win") {
      playSound("win");
      recordGameEvent({ kind: "karogs-won", opponent: "online" });
    } else {
      playSound("lose");
    }
  }, [view?.status, recorded, mySide, view]);

  const setupCells = useMemo(() => {
    const cells = emptyBoard();
    for (const [cell, piece] of Object.entries(placement)) cells[Number(cell)] = piece;
    return cells;
  }, [placement]);

  const boardCells =
    view?.status === "setup"
      ? setupCells
      : view?.board ?? null;

  const inviteUrl =
    typeof window !== "undefined" && view
      ? `${window.location.origin}/karogs/${view.code}`
      : "";

  if (!session) {
    if (onlineDisabled) {
      return (
        <Card className="mx-auto max-w-md p-6 text-center">
          <Globe className="mx-auto size-7 text-stone-400" aria-hidden />
          <p className="mt-3 font-bold">Tiešsaistes spēle pagaidām nav pieejama</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Spēle ar draugu prasa tiešsaistes serveri, kas šobrīd nav ieslēgts.
            Izmēģini <b>Pret datoru</b> vai <b>Divatā uz viena ekrāna</b>.
          </p>
        </Card>
      );
    }
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 font-bold">
            <Globe className="size-5 text-indigo-500" aria-hidden />
            Tiešsaistes spēle ar draugu
          </div>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Izveido privātu istabu un uzaicini draugu ar saiti vai sešu zīmju kodu.
          </p>
          <label className="mt-4 block text-xs font-bold text-stone-500 dark:text-stone-400">
            Tavs segvārds
            <input
              value={nickname || settings.nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Spēlētājs"
              maxLength={20}
              className="mt-1 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium dark:border-stone-600 dark:bg-stone-800"
            />
          </label>
          <Button className="mt-3 w-full" onClick={create}>
            Izveidot istabu
          </Button>
          <div className="my-4 flex items-center gap-2 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            vai
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="KODS"
              aria-label="Istabas kods"
              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-center font-mono text-lg font-bold tracking-[0.3em] uppercase dark:border-stone-600 dark:bg-stone-800"
            />
            <Button variant="secondary" disabled={codeInput.length !== 6} onClick={join}>
              Pievienoties
            </Button>
          </div>
          {error ? <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p> : null}
        </Card>
        {(() => {
          const active = Object.values(loadOnlineSessions());
          if (active.length === 0) return null;
          return (
            <Card className="p-4">
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                Aktīvās spēles
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.map((s) => (
                  <button
                    key={s.gameId}
                    onClick={() => setSession(s)}
                    className="rounded-lg bg-stone-100 px-3 py-1.5 font-mono text-sm font-bold tracking-widest transition hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </Card>
          );
        })()}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900">
        <Loader2 className="size-7 animate-spin text-indigo-500" aria-hidden />
        <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          Savienojamies ar istabu…
        </p>
        <Button variant="ghost" size="sm" onClick={leave}>
          <LogOut className="size-4" aria-hidden />
          Atvienoties
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!online ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <WifiOff className="size-4" aria-hidden />
          Bez interneta savienojuma — tiešsaistes spēle apturēta
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-indigo-100 px-3 py-1.5 font-mono text-lg font-black tracking-[0.25em] text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
            {view.code}
          </span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } catch {
                /* ignore */
              }
            }}
            aria-label="Kopēt uzaicinājuma saiti"
            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {copied ? <Check className="size-4 text-emerald-500" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">
            <Shield className="size-3.5" aria-hidden />
            {view.players.red?.nickname ?? "Sarkanais"}
            {view.players.red?.ready ? " ✓" : ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <Swords className="size-3.5" aria-hidden />
            {view.players.blue?.nickname ?? "Zilais"}
            {view.players.blue?.ready ? " ✓" : ""}
          </span>
          <button
            onClick={leave}
            aria-label="Atstāt istabu"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {view.status === "waiting" ? (
        <Card className="mx-auto max-w-md p-6 text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-indigo-500" aria-hidden />
          <p className="mt-3 font-bold">Gaidi pretinieku…</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Nosūti draugam saiti vai kodu <b>{view.code}</b>.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => void act("cancel")}
          >
            Atcelt istabu
          </Button>
        </Card>
      ) : null}

      {view.status === "setup" ? (
        <>
          <KarogsBoard
            cells={boardCells ?? emptyBoard()}
            viewer={mySide ?? "red"}
            selected={null}
            destinations={[]}
            lastMove={null}
            onCellClick={(i) => controller.handleCell(i)}
            onCellDrop={(i) => controller.handleDrop(i)}
            zoom={zoom}
            onZoom={() => setZoom((z) => !z)}
            boardLabel="Tavs slepenais izvietojums"
          />
          <SetupPanel
            side={mySide ?? "red"}
            placement={placement}
            controller={controller}
            onPlacementChange={setPlacement}
            onReady={submitSetup}
            ready={view.ready}
            readyLabel={view.ready ? "Gatavs" : "Gatavs kaujai"}
          />
          <p className="text-center text-sm text-stone-500 dark:text-stone-400" aria-live="polite">
            {view.ready
              ? view.players.blue?.ready && view.players.red?.ready
                ? "Abi spēlētāji gatavi — kauja sākas!"
                : "Gaidi, kamēr pretinieks pabeidz izvietošanu…"
              : `Pretinieks: ${view.players[mySide === "red" ? "blue" : "red"]?.nickname ?? "?"}${view.players[mySide === "red" ? "blue" : "red"]?.ready ? " — gatavs" : " — vēl izvieto armiju"}`}
          </p>
        </>
      ) : null}

      {view.status === "playing" || view.status === "finished" ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold" aria-live="polite">
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">
              S: 40 − {view.captured.red}
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Z: 40 − {view.captured.blue}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              {view.status === "finished"
                ? endLabel({ winner: view.winner })
                : view.turn === mySide
                  ? "Tava kārta"
                  : "Pretinieka kārta"}
            </span>
          </div>
          <KarogsBoard
            cells={boardCells ?? emptyBoard()}
            viewer={mySide ?? "red"}
            selected={selected}
            destinations={view.turn === mySide ? destinations : []}
            lastMove={
              view.moves.length > 0
                ? {
                    from: view.moves[view.moves.length - 1].from,
                    to: view.moves[view.moves.length - 1].to,
                  }
                : null
            }
            onCellClick={onCellClick}
            disabled={view.status !== "playing" || view.turn !== mySide || busy}
            zoom={zoom}
            onZoom={() => setZoom((z) => !z)}
            boardLabel={view.status === "finished" ? "Spēle beigusies — visas figūras atklātas" : "Kaujas laukums"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {view.status === "playing" ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void act("resign")}
                >
                  Padoties
                </Button>
                {view.claimable ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void act("claim-abandon")}
                  >
                    Pretinieks pazudis — pieprasīt uzvaru
                  </Button>
                ) : null}
              </div>
            ) : (
              <span />
            )}
            <MoveLog moves={view.moves} />
          </div>
        </>
      ) : null}

      {view.status === "finished" ? (
        <Card className="mx-auto max-w-lg p-5 text-center">
          <p className="text-lg font-extrabold">
            {view.winner === "draw"
              ? "Neizšķirts"
              : view.winner === mySide
                ? "Uzvara! 🎉"
                : "Zaudējums"}
          </p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            {endLabel({ winner: view.winner })}
            {view.endReason ? ` — ${reasonLabel(view.endReason)}` : ""}.
          </p>
          {view.rematchCode ? (
            <div className="mt-3 rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">
              Revanšs izveidots! Kods:{" "}
              <b className="font-mono tracking-widest">{view.rematchCode}</b>
              <Button size="sm" className="mt-2 w-full" onClick={acceptRematch}>
                Pievienoties revanšam
              </Button>
            </div>
          ) : (
            <Button size="sm" className="mt-3" onClick={requestRematch} disabled={busy}>
              Uzaicināt uz revanšu (samainot krāsas)
            </Button>
          )}
          <div className="mt-2">
            <Link
              href="/karogs"
              className="text-xs font-semibold text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              Atpakaļ uz Karogs sākumu
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
