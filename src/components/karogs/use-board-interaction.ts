"use client";

import { useEffect, useRef, useState } from "react";
import {
  type GameState,
  type Move,
  type Side,
  legalMoves,
} from "@/lib/karogs/engine";

export function useBoardInteraction(
  game: GameState | null,
  viewer: Side,
  onMove: (move: Move) => void,
) {
  const [selected, setSelected] = useState<number | null>(null);
  const [destinations, setDestinations] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const dragStartRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(null);
    setDestinations([]);
    if (game && game.moves.length > 0) {
      const last = game.moves[game.moves.length - 1];
      setLastMove({ from: last.from, to: last.to });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.moves.length, game?.turn]);

  const myTurn = !!game && game.phase === "playing" && game.turn === viewer;

  const select = (idx: number) => {
    if (!game || !myTurn) return;
    const piece = game.board[idx];
    if (piece && piece.owner === viewer && piece.kind === "movable") {
      const moves = legalMoves(game, viewer).filter((m) => m.pieceId === piece.id);
      if (moves.length === 0) return;
      setSelected(idx);
      setDestinations(moves.map((m) => m.to));
    } else {
      setSelected(null);
      setDestinations([]);
    }
  };

  const click = (idx: number) => {
    if (!game) return;
    if (selected !== null && destinations.includes(idx)) {
      const piece = game.board[selected];
      if (piece) onMove({ pieceId: piece.id, to: idx });
      setSelected(null);
      setDestinations([]);
      dragStartRef.current = null;
      return;
    }
    select(idx);
  };

  const pointerDown = (idx: number) => {
    if (!game || !myTurn) return;
    const piece = game.board[idx];
    if (piece && piece.owner === viewer) {
      dragStartRef.current = idx;
      select(idx);
    }
  };

  const drop = (idx: number) => {
    if (dragStartRef.current === null) return;
    if (destinations.includes(idx)) {
      const piece = game?.board[dragStartRef.current];
      if (piece) onMove({ pieceId: piece.id, to: idx });
      setSelected(null);
      setDestinations([]);
    }
    dragStartRef.current = null;
  };

  return { selected, destinations, lastMove, click, pointerDown, drop, myTurn };
}
