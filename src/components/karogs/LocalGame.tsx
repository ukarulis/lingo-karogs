"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KarogsBoard } from "./KarogsBoard";
import { MoveLog } from "./MoveLog";
import { ResultPanel } from "./ResultPanel";
import { SetupPanel, useSetupController } from "./SetupPanel";
import { useBoardInteraction } from "./use-board-interaction";
import {
  type GameState,
  type Piece,
  type Side,
  applyMove,
  createGame,
  emptyBoard,
  otherSide,
  redactFor,
  resign,
  setSetup,
  startGame,
} from "@/lib/karogs/engine";
import { summarizeFinished } from "@/lib/karogs/summary";
import { applyFormation, formationById } from "@/lib/karogs/formations";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { recordKarogsGame } from "@/lib/store/karogsStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { loadGame, saveGame, storageRemove } from "@/lib/store/storage";

type LocalPhase = "setup-red" | "setup-blue" | "playing" | "finished";

interface Curtain {
  title: string;
  text: string;
  nextViewer: Side;
}

interface LocalSave {
  state: GameState;
  phase: LocalPhase;
  redPlacement: Record<number, Piece>;
  bluePlacement: Record<number, Piece>;
}

function isLocalSave(raw: unknown): raw is LocalSave {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<LocalSave>;
  return !!s.state && Array.isArray(s.state.board) && !!s.phase;
}

export function LocalGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [phase, setPhase] = useState<LocalPhase>("setup-red");
  const [viewer, setViewer] = useState<Side>("red");
  const [curtain, setCurtain] = useState<Curtain | null>(null);
  const [redPlacement, setRedPlacement] = useState<Record<number, Piece>>(() => {
    const formation = formationById("balanced");
    return formation ? applyFormation(formation, "red", Math.random) : {};
  });
  const [bluePlacement, setBluePlacement] = useState<Record<number, Piece>>(() => {
    const formation = formationById("balanced");
    return formation ? applyFormation(formation, "blue", Math.random) : {};
  });
  const [reveal, setReveal] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const { push } = useToast();

  const redCtrl = useSetupController("red", redPlacement, setRedPlacement, {
    initialFormationId: "balanced",
  });
  const blueCtrl = useSetupController("blue", bluePlacement, setBluePlacement, {
    initialFormationId: "balanced",
  });

  useEffect(() => {
    const stored = loadGame<LocalSave>("karogsLocalGame", isLocalSave)?.data ?? null;
    if (stored?.state) {
      setState(stored.state);
      setPhase(stored.phase);
      if (stored.state.phase === "setup") {
        setRedPlacement(stored.redPlacement ?? {});
        setBluePlacement(stored.bluePlacement ?? {});
      }
    } else {
      setState(createGame());
    }
  }, []);

  useEffect(() => {
    if (state) {
      saveGame(
        "karogsLocalGame",
        { state, phase, redPlacement, bluePlacement },
        state.phase,
      );
    }
  }, [state, phase, redPlacement, bluePlacement]);

  useEffect(() => {
    if (state?.phase === "finished" && !recorded) {
      setRecorded(true);
      setPhase("finished");
      const summary = summarizeFinished(state);
      const result = state.winner === "red" ? "win" : state.winner === "blue" ? "loss" : "draw";
      recordKarogsGame({
        id: crypto.randomUUID(),
        opponent: "local-human",
        result,
        moves: summary.moves,
        durationSec: summary.durationSec,
        flagCaptured: summary.flagCaptured,
        spyKilledMarshal: summary.spyKilledMarshal,
        bombDefused: summary.bombDefused,
        date: new Date().toISOString(),
      });
      if (result === "win") {
        playSound("win");
        recordGameEvent({ kind: "karogs-won", opponent: "local-human" });
      } else {
        playSound("lose");
      }
      if (summary.spyKilledMarshal) recordGameEvent({ kind: "karogs-spy-kill" });
      if (summary.bombDefused) recordGameEvent({ kind: "karogs-defuse" });
    }
  }, [state, recorded]);

  const interaction = useBoardInteraction(state, viewer, (move) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = applyMove(prev, move);
      playSound("capture");
      if (next.phase === "finished") {
        setCurtain({
          title: "Spēle beigusies",
          text: "Nodod ierīci otram spēlētājam, lai abi redzētu gala rezultātu.",
          nextViewer: otherSide(viewer),
        });
      } else {
        setCurtain({
          title: `${otherSide(viewer) === "blue" ? "Zilā" : "Sarkanā"} spēlētāja gājiens`,
          text: "Nodod ierīci otram spēlētājam, lai viņš neredzētu tavas figūras.",
          nextViewer: otherSide(viewer),
        });
      }
      return next;
    });
  });

  const redReady = () => {
    if (!state) return;
    try {
      const next = setSetup(state, "red", redPlacement);
      setState(next);
      setPhase("setup-blue");
      setCurtain({
        title: "Zilā spēlētāja izvietošana",
        text: "Nodod ierīci zilajam spēlētājam. Viņš izvietos savu armiju.",
        nextViewer: "blue",
      });
    } catch (err) {
      push(err instanceof Error ? err.message : "Nederīgs izvietojums", "error");
    }
  };

  const blueReady = () => {
    if (!state) return;
    try {
      let next = setSetup(state, "blue", bluePlacement);
      next = startGame(next);
      setState(next);
      setPhase("playing");
      playSound("start");
      setCurtain({
        title: "Kauja sākas!",
        text: "Nodod ierīci sarkanajam spēlētājam — sarkanā armija iet pirmā.",
        nextViewer: "red",
      });
    } catch (err) {
      push(err instanceof Error ? err.message : "Nederīgs izvietojums", "error");
    }
  };

  const newGame = () => {
    storageRemove("karogsLocalGame");
    setState(createGame());
    setPhase("setup-red");
    setRedPlacement(
      applyFormation(formationById("balanced")!, "red", Math.random),
    );
    setBluePlacement(
      applyFormation(formationById("balanced")!, "blue", Math.random),
    );
    setRecorded(false);
    setReveal(false);
    setCurtain(null);
    setViewer("red");
  };

  const boardCells = useMemo(() => {
    if (!state) return emptyBoard();
    if (phase === "setup-red") {
      const cells = emptyBoard();
      for (const [cell, piece] of Object.entries(redPlacement)) cells[Number(cell)] = piece;
      return cells;
    }
    if (phase === "setup-blue") {
      const cells = emptyBoard();
      for (const [cell, piece] of Object.entries(bluePlacement)) cells[Number(cell)] = piece;
      return cells;
    }
    return reveal
      ? state.board.map((p) => (p ? { ...p, redSees: true, blueSees: true } : null))
      : redactFor(state, viewer);
  }, [state, phase, viewer, reveal, redPlacement, bluePlacement]);

  const setupCellsActive = phase === "setup-red" || phase === "setup-blue";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Users className="size-4 text-indigo-500" aria-hidden />
          Divatā uz viena ekrāna
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200"
          aria-live="polite"
        >
          <Shield className="size-3.5" aria-hidden />
          {viewer === "red" ? "Sarkanais spēlētājs" : "Zilais spēlētājs"}
        </div>
      </div>

      <KarogsBoard
        cells={boardCells}
        viewer={viewer}
        selected={setupCellsActive ? null : interaction.selected}
        destinations={setupCellsActive || state?.turn !== viewer ? [] : interaction.destinations}
        lastMove={setupCellsActive ? null : interaction.lastMove}
        onCellClick={(i) => {
          if (phase === "setup-red") redCtrl.handleCell(i);
          else if (phase === "setup-blue") blueCtrl.handleCell(i);
          else interaction.click(i);
        }}
        onCellDrop={(i) => {
          if (phase === "setup-red") redCtrl.handleDrop(i);
          else if (phase === "setup-blue") blueCtrl.handleDrop(i);
          else interaction.drop(i);
        }}
        disabled={!setupCellsActive && (state?.turn !== viewer || phase === "finished")}
        zoom={zoom}
        onZoom={() => setZoom((z) => !z)}
        boardLabel={
          phase === "setup-red"
            ? "Sarkanā izvietojums"
            : phase === "setup-blue"
              ? "Zilā izvietojums"
              : "Kaujas laukums"
        }
      />

      {phase === "setup-red" ? (
        <SetupPanel
          side="red"
          placement={redPlacement}
          controller={redCtrl}
          onPlacementChange={setRedPlacement}
          onReady={redReady}
          readyLabel="Gatavs — nodot zilajam"
        />
      ) : null}
      {phase === "setup-blue" ? (
        <SetupPanel
          side="blue"
          placement={bluePlacement}
          controller={blueCtrl}
          onPlacementChange={setBluePlacement}
          onReady={blueReady}
          readyLabel="Sākt kauju"
        />
      ) : null}

      {phase === "playing" && state ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setState((prev) =>
                prev && prev.phase === "playing"
                  ? resign(prev, viewer)
                  : prev,
              )
            }
          >
            Padoties
          </Button>
          <MoveLog moves={state.moves} />
        </div>
      ) : null}

      {phase === "finished" && state ? (
        <>
          <ResultPanel
            state={state}
            viewer={viewer}
            reveal={reveal}
            setReveal={setReveal}
          />
          <div className="flex justify-center">
            <Button variant="secondary" onClick={newGame}>
              Jauna spēle
            </Button>
          </div>
        </>
      ) : null}

      {curtain ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/85 p-6 backdrop-blur">
          <div className="max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center text-stone-100 shadow-2xl">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-indigo-600 text-2xl">
              {curtain.nextViewer === "blue" ? "🛡️" : "⚔️"}
            </div>
            <h2 className="text-lg font-extrabold">{curtain.title}</h2>
            <p className="mt-2 text-sm text-stone-300">{curtain.text}</p>
            <p className="mt-1 text-xs text-stone-500">
              Ekrāns paslēpts, lai neviena armija netiktu atklāta priekšlaicīgi.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setViewer(curtain.nextViewer);
                setCurtain(null);
              }}
            >
              Esmu {curtain.nextViewer === "blue" ? "zilais" : "sarkanais"} spēlētājs
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
