"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguagePack } from "@/lib/lingo/pack/types";
import { latvianPack } from "@/lib/lingo/pack/latvian";

const DEFAULT_LENGTH = 5;

function normalizeLength(
  values: (string | null)[],
  length: number,
): (string | null)[] {
  return Array.from({ length }, (_, i) => values[i] ?? null);
}

/**
 * Controlled letter input with explicit accept/reject semantics.
 * The editable buffer is cleared synchronously only after the parent accepts
 * a submission, so failed submissions (invalid or duplicate words) stay
 * editable and rapid Enter presses can never double-submit. A cursor tracks
 * the next expected position: typing a letter that matches a locked position
 * (revealed first letter, hint, carried-forward letter) advances past it, so
 * typing the complete word behaves intuitively, while backspace never
 * corrupts locked hints.
 */
export function useGuessInput({
  enabled,
  fixedPositions,
  length = DEFAULT_LENGTH,
  pack = latvianPack,
  onSubmit,
}: {
  enabled: boolean;
  /** Positions the user cannot change (first letter, revealed hints). */
  fixedPositions: (string | null)[];
  /** Return true when the guess was accepted; false keeps the word editable. */
  onSubmit: (word: string) => boolean;
  length?: number;
  pack?: LanguagePack;
}) {
  const [buffer, setBuffer] = useState<(string | null)[]>(() =>
    normalizeLength(
      fixedPositions.map((f) => f ?? null),
      length,
    ),
  );
  const [shakeTick, setShakeTick] = useState(0);
  const bufferRef = useRef(buffer);
  const enabledRef = useRef(enabled);
  const fixedRef = useRef(fixedPositions);
  const prevFixedRef = useRef<(string | null)[]>([]);
  /** Next position the player is expected to type at. */
  const cursorRef = useRef(0);

  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Keep the buffer in sync with fixed positions whenever they change:
  // locked letters are written in, and letters locked by a previous round are
  // cleared when a new round unlocks their position.
  useEffect(() => {
    const prevFixed = prevFixedRef.current;
    fixedRef.current = fixedPositions;
    setBuffer((prev) => {
      const next = normalizeLength(prev, length);
      let changed = false;
      fixedPositions.forEach((f, i) => {
        if (f !== null && next[i] !== f) {
          next[i] = f;
          changed = true;
        } else if (
          f === null &&
          prevFixed[i] !== null &&
          next[i] === prevFixed[i]
        ) {
          next[i] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    prevFixedRef.current = fixedPositions;
    cursorRef.current = Math.min(cursorRef.current, length);
  }, [fixedPositions, length]);

  const append = useCallback(
    (raw: string) => {
      if (!enabledRef.current) return;
      const ch = pack.normalizeInput(raw);
      if (ch.length === 0) return;
      // Only single graphemes may enter a cell (rejects dead-key markers,
      // pasted strings routed through append, and multi-codepoint junk).
      if (pack.segmentWord(ch).length !== 1) return;
      const prev = normalizeLength(bufferRef.current, length);
      const fixed = fixedRef.current;
      let cursor = Math.min(cursorRef.current, length);
      // Typing the letter shown at a locked position "consumes" it: the
      // letter is already visible, so the keystroke only advances the cursor.
      let consumed = false;
      while (cursor < length && fixed[cursor] !== null && fixed[cursor] === ch) {
        consumed = true;
        cursor += 1;
      }
      if (consumed) {
        cursorRef.current = cursor;
        return;
      }
      if (cursor >= length) return;
      const next = [...prev];
      if (fixed[cursor] !== null || next[cursor] !== null) {
        // The cursor sits on a locked letter the typed key does not match
        // (or an already-filled cell): place the letter in the next free
        // editable position so the row always shows what will be submitted.
        let target = -1;
        for (let i = cursor; i < length; i++) {
          if (next[i] === null && fixed[i] === null) {
            target = i;
            break;
          }
        }
        if (target === -1) return;
        next[target] = ch;
        cursor = target + 1;
      } else {
        next[cursor] = ch;
        cursor += 1;
      }
      bufferRef.current = next;
      cursorRef.current = cursor;
      setBuffer(next);
    },
    [length, pack],
  );

  const backspace = useCallback(() => {
    if (!enabledRef.current) return;
    const prev = normalizeLength(bufferRef.current, length);
    const fixed = fixedRef.current;
    let i = Math.min(cursorRef.current, length) - 1;
    while (i >= 0 && (prev[i] === null || fixed[i] !== null)) i--;
    if (i < 0) return; // nothing editable to delete; locked hints stay intact
    const next = [...prev];
    next[i] = null;
    cursorRef.current = i;
    bufferRef.current = next;
    setBuffer(next);
  }, [length]);

  const submit = useCallback((): boolean => {
    if (!enabledRef.current) return false;
    const current = normalizeLength(bufferRef.current, length);
    if (current.some((c) => c === null)) {
      setShakeTick((t) => t + 1);
      return false;
    }
    const accepted = onSubmit(current.join(""));
    if (accepted) {
      // Clear editable letters synchronously (fixed positions stay put).
      const next = normalizeLength(
        fixedRef.current.map((f) => f ?? null),
        length,
      );
      cursorRef.current = 0;
      bufferRef.current = next;
      setBuffer(next);
    }
    return accepted;
  }, [length, onSubmit]);

  /**
   * Explicitly clear the editable letters (used by asynchronous flows that
   * confirm acceptance from an authoritative server response).
   */
  const reset = useCallback(() => {
    const next = normalizeLength(
      fixedRef.current.map((f) => f ?? null),
      length,
    );
    cursorRef.current = 0;
    bufferRef.current = next;
    setBuffer(next);
  }, [length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Ctrl/Meta shortcuts (Ctrl+A, Cmd+R, ...) must keep working, but
      // Windows AltGr produces characters while holding Ctrl+Alt: those
      // events are legitimate printable input and must be accepted.
      const altGraph =
        typeof e.getModifierState === "function" &&
        e.getModifierState("AltGraph");
      const altGrCombo = e.ctrlKey && e.altKey && !e.metaKey;
      if ((e.metaKey || e.ctrlKey || e.altKey) && !altGraph && !altGrCombo) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else {
        const normalized = pack.normalizeInput(e.key);
        if (normalized.length > 0 && pack.validateCharacters(normalized)) {
          append(e.key);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [append, backspace, submit, pack]);

  const full = buffer.every((c) => c !== null) && buffer.length === length;
  return { buffer, full, shakeTick, append, backspace, submit, reset };
}
