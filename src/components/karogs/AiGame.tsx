"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Flag, Shield, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { KarogsBoard } from "./KarogsBoard";
import { MoveLog } from "./MoveLog";
import { ResultPanel } from "./ResultPanel";
import { SetupPanel, useSetupController } from "./SetupPanel";
import { useBoardInteraction } from "./use-board-interaction";
import {
  type GameState,
  type Piece,
  applyMove,
  createGame,
  emptyBoard,
  randomSetup,
  redactFor,
  resign,
  setSetup,
  startGame,
  legalMoves,
} from "@/lib/karogs/engine";
import { aiView, chooseMove, type AiDifficulty } from "@/lib/karogs/ai";
import { summarizeFinished } from "@/lib/karogs/summary";
import { mulberry32 } from "@/lib/utils";
import { playSound } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { recordKarogsGame } from "@/lib/store/karogsStats";
import { recordGameEvent } from "@/lib/store/achievements";
import { storageGet, storageRemove, storageSet } from "@/lib/store/storage";

/** E2E-only deterministic scenario: red scout has a clear path to blue flag. */
function scenarioOpenFlag(): GameState {
  let st = createGame();
  const redSetup = randomSetup("red", mulberry32(7));
  const blueSetup = randomSetup("blue", mulberry32(11));
  const scoutId = "red-2-0";
  const flagId = "blue-flag-0";
  const redCell = 64; // (4,6)
  const flagCell = 34; // (4,3)
  const redAt = Object.entries(redSetup).find(([, p]) => p.id === scoutId);
  const flagAt = Object.entries(blueSetup).find(([, p]) => p.id === flagId);
  if (redAt) {
    // Swap with the piece currently occupying the destination cell so the
    // army keeps all 40 pieces.
    const displaced = redSetup[redCell];
    redSetup[Number(redAt[0])] = displaced;
  }
  if (flagAt) {
    const displaced = blueSetup[flagCell];
    blueSetup[Number(flagAt[0])] = displaced;
  }
  redSetup[redCell] = {
    id: scoutId,
    owner: "red",
    kind: "movable",
    rank: 2,
    redSees: true,
    blueSees: false,
  };
  blueSetup[flagCell] = {
    id: flagId,
    owner: "blue",
    kind: "flag",
    rank: null,
    redSees: false,
    blueSees: true,
  };
  st = setSetup(st, "red", redSetup);
  st = setSetup(st, "blue", blueSetup);
  return startGame(st);
}

type AiGameState = "setup" | "playing" | "finished";

export function AiGame({
  difficulty,
  onDifficultyChange,
}: {
  difficulty: AiDifficulty;
  onDifficultyChange: (d: AiDifficulty) => void;
}) {
  const [state, setState] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<AiGameState>("setup");
  const [placement, setPlacement] = useState<Record<number, Piece>>({});
  const [reveal, setReveal] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const { push } = useToast();

  const controller = useSetupController("red", placement, setPlacement);

  useEffect(() => {
    const stored = storageGet<{ state: GameState; placement: Record<number, Piece> }>(
      "karogsAiGame",
    );
    if (stored?.state) {
      if (stored.state.phase === "setup") {
        setPlacement(stored.placement ?? {});
      } else {
        setState(stored.state);
        setScreen(stored.state.phase === "finished" ? "finished" : "playing");
      }
      return;
    }
    if (
      process.env.NEXT_PUBLIC_E2E &&
      new URLSearchParams(window.location.search).get("scenario") === "open-flag"
    ) {
      setState(scenarioOpenFlag());
      setScreen("playing");
    }
  }, []);

  useEffect(() => {
    if (state || Object.keys(placement).length > 0) {
      storageSet("karogsAiGame", { state, placement });
    }
  }, [state, placement]);

  // AI turn.
  useEffect(() => {
    if (!state || state.phase !== "playing" || state.turn !== "blue") return;
    const t = window.setTimeout(() => {
      try {
        const view = aiView(state, "blue");
        const move = chooseMove(view, "blue", difficulty);
        setState((prev) => (prev ? applyMove(prev, move) : prev));
        playSound("capture");
      } catch {
        // Fallback: never let the AI stall the game.
        const moves = legalMoves(state, "blue");
        if (moves.length > 0) {
          setState((prev) => (prev ? applyMove(prev, moves[0]) : prev));
        }
      }
    }, 500 + Math.random() * 350);
    return () => window.clearTimeout(t);
  }, [state, difficulty]);

  // Finished: record once.
  useEffect(() => {
    if (state?.phase !== "finished" || recorded) return;
    setRecorded(true);
    setScreen("finished");
    const summary = summarizeFinished(state);
    const result =
      state.winner === "red" ? "win" : state.winner === "blue" ? "loss" : "draw";
    recordKarogsGame({
      id: crypto.randomUUID(),
      opponent: `ai-${difficulty}`,
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
      recordGameEvent({ kind: "karogs-won", opponent: `ai-${difficulty}` });
    } else {
      playSound("lose");
    }
    if (summary.spyKilledMarshal) recordGameEvent({ kind: "karogs-spy-kill" });
    if (summary.bombDefused) recordGameEvent({ kind: "karogs-defuse" });
  }, [state, recorded, difficulty]);

  const interaction = useBoardInteraction(state, "red", (move) => {
    setState((prev) => (prev ? applyMove(prev, move) : prev));
  });

  const start = () => {
    let st = createGame();
    try {
      st = setSetup(st, "red", placement);
      st = setSetup(st, "blue", randomSetup("blue", Math.random));
      st = startGame(st);
      setState(st);
      setScreen("playing");
      playSound("start");
    } catch (err) {
      push(err instanceof Error ? err.message : "Nederīgs izvietojums", "error");
    }
  };

  const reset = () => {
    storageRemove("karogsAiGame");
    setState(null);
    setPlacement({});
    setScreen("setup");
    setRecorded(false);
    setReveal(false);
  };

  const setupCells = useMemo(() => {
    const cells = emptyBoard();
    for (const [cell, piece] of Object.entries(placement)) {
      cells[Number(cell)] = piece;
    }
    return cells;
  }, [placement]);

  const boardCells =
    state && screen !== "setup"
      ? reveal
        ? state.board.map((p) => (p ? { ...p, redSees: true, blueSees: true } : null))
        : redactFor(state, "red")
      : setupCells;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Bot className="size-4 text-indigo-500" aria-hidden />
          Pret datoru
          <span className="font-medium text-stone-500">
            {screen === "playing" && state
              ? state.turn === "red"
                ? "— tava kārta"
                : "— dators domā…"
              : ""}
          </span>
        </div>
        <Segmented<AiDifficulty>
          ariaLabel="Datora spēks"
          value={difficulty}
          onChange={onDifficultyChange}
          options={[
            { value: "easy", label: "Viegls" },
            { value: "medium", label: "Vidējs" },
            { value: "hard", label: "Spēcīgs" },
          ]}
        />
      </div>

      {screen === "setup" ? (
        <>
          <KarogsBoard
            cells={setupCells}
            viewer="red"
            selected={null}
            destinations={[]}
            lastMove={null}
            onCellClick={(i) => controller.handleCell(i)}
            onCellDrop={(i) => controller.handleDrop(i)}
            zoom={zoom}
            onZoom={() => setZoom((z) => !z)}
            boardLabel="Tavs izvietojums (sarkanā armija)"
          />
          <SetupPanel
            side="red"
            placement={placement}
            controller={controller}
            onPlacementChange={setPlacement}
            onReady={start}
            readyLabel="Sākt kauju"
          />
        </>
      ) : null}

      {screen !== "setup" && state ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">
              <Flag className="size-3.5" aria-hidden />
              Tu: 40 − {state.captured.red}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              <Swords className="size-3.5" aria-hidden />
              Dators: 40 − {state.captured.blue}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
              aria-live="polite"
            >
              <Shield className="size-3.5" aria-hidden />
              {state.turn === "red" ? "Sarkanā kārta" : "Zilā kārta"}
            </span>
          </div>
          <KarogsBoard
            cells={boardCells}
            viewer="red"
            selected={interaction.selected}
            destinations={state.turn === "red" ? interaction.destinations : []}
            lastMove={interaction.lastMove}
            onCellClick={interaction.click}
            onCellHover={() => undefined}
            onCellDrop={interaction.drop}
            disabled={state.turn !== "red" || screen === "finished"}
            zoom={zoom}
            onZoom={() => setZoom((z) => !z)}
            boardLabel={screen === "finished" ? "Spēle beigusies" : "Kaujas laukums"}
          />
          {screen === "playing" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setState((prev) => (prev ? resign(prev, "red") : prev));
                }}
              >
                Padoties
              </Button>
              <MoveLog moves={state.moves} />
            </div>
          ) : null}
          {screen === "finished" ? (
            <ResultPanel
              state={state}
              viewer="red"
              onReplay={reset}
              reveal={reveal}
              setReveal={setReveal}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
