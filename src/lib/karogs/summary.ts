import type { GameState } from "./engine";

export interface GameSummary {
  moves: number;
  durationSec: number;
  flagCaptured: boolean;
  spyKilledMarshal: boolean;
  bombDefused: boolean;
}

export function summarizeFinished(state: GameState): GameSummary {
  let spyKilledMarshal = false;
  let bombDefused = false;
  let flagCaptured = false;
  for (const m of state.moves) {
    if (m.outcome === "capture-flag") flagCaptured = true;
    if (m.attackerRank === 1 && m.defenderRank === 10 && m.outcome === "attack") {
      spyKilledMarshal = true;
    }
    if (m.defenderKind === "bomb" && m.outcome === "attack") bombDefused = true;
  }
  return {
    moves: state.moves.length,
    durationSec: Math.max(0, Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 1000)),
    flagCaptured,
    spyKilledMarshal,
    bombDefused,
  };
}
