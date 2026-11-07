"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LATVIAN_KEY = /^[a-zA-ZāčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]$/;
const LENGTH = 5;

function normalizeLength(values: (string | null)[]): (string | null)[] {
  return Array.from({ length: LENGTH }, (_, i) => values[i] ?? null);
}

export function useGuessInput({
  enabled,
  fixedPositions,
  onSubmit,
}: {
  enabled: boolean;
  /** Positions the user cannot change (first letter, revealed hints). */
  fixedPositions: (string | null)[];
  onSubmit: (word: string) => void;
}) {
  const [buffer, setBuffer] = useState<(string | null)[]>(() =>
    normalizeLength(fixedPositions.map((f, i) => (f || i === 0 ? f : null))),
  );
  const [shakeTick, setShakeTick] = useState(0);
  const bufferRef = useRef(buffer);

  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  // Keep the buffer in sync with fixed positions (first letter, revealed
  // hints) whenever they change.
  useEffect(() => {
    setBuffer((prev) => {
      const next = normalizeLength(prev);
      let changed = prev.length !== LENGTH;
      fixedPositions.forEach((f, i) => {
        if (f && next[i] !== f) {
          next[i] = f;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [fixedPositions]);

  const append = useCallback(
    (raw: string) => {
      const ch = raw.toLowerCase();
      const prev = normalizeLength(bufferRef.current);
      const typedCount = prev.filter(
        (c, i) => c !== null && !fixedPositions[i],
      ).length;
      if (typedCount === 0 && fixedPositions[0] && ch === fixedPositions[0]) {
        // The prefilled first letter is already shown; ignore re-typing it.
        return;
      }
      const next = [...prev];
      const firstEmpty = next.findIndex(
        (c, i) => c === null && !fixedPositions[i],
      );
      if (firstEmpty === -1) return;
      next[firstEmpty] = ch;
      bufferRef.current = next;
      setBuffer(next);
    },
    [fixedPositions],
  );

  const backspace = useCallback(() => {
    const prev = normalizeLength(bufferRef.current);
    const next = [...prev];
    let i = next.length - 1;
    while (i >= 0 && (next[i] === null || fixedPositions[i])) i--;
    if (i < 0) return;
    next[i] = null;
    bufferRef.current = next;
    setBuffer(next);
  }, [fixedPositions]);

  const submit = useCallback(() => {
    if (!enabled) return;
    const current = normalizeLength(bufferRef.current);
    if (current.some((c) => c === null)) {
      setShakeTick((t) => t + 1);
      return;
    }
    onSubmit(current.join(""));
  }, [enabled, onSubmit]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (LATVIAN_KEY.test(e.key)) {
        append(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [append, backspace, submit, enabled]);

  const full = buffer.every((c) => c !== null) && buffer.length === LENGTH;
  return { buffer, full, shakeTick, append, backspace, submit };
}
