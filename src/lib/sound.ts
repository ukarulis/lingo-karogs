// Tiny WebAudio synth - no external assets.

import { loadSettings } from "./store/settings";

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.08,
): void {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainValue, c.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.05);
}

export type SoundId =
  | "tap"
  | "flip"
  | "win"
  | "lose"
  | "error"
  | "capture"
  | "life"
  | "hint"
  | "start";

export function playSound(id: SoundId): void {
  if (!loadSettings().sound) return;
  if (loadSettings().reducedMotion && id !== "win" && id !== "lose") return;
  try {
    switch (id) {
      case "tap":
        tone(520, 0, 0.06, "triangle", 0.05);
        break;
      case "flip":
        tone(360, 0, 0.08, "sine", 0.05);
        break;
      case "win":
        tone(523.25, 0, 0.12, "sine", 0.07);
        tone(659.25, 0.1, 0.12, "sine", 0.07);
        tone(783.99, 0.2, 0.22, "sine", 0.08);
        break;
      case "lose":
        tone(220, 0, 0.2, "sawtooth", 0.04);
        tone(174.6, 0.18, 0.3, "sawtooth", 0.04);
        break;
      case "error":
        tone(180, 0, 0.1, "square", 0.04);
        break;
      case "capture":
        tone(240, 0, 0.08, "square", 0.05);
        tone(180, 0.07, 0.12, "square", 0.05);
        break;
      case "life":
        tone(700, 0, 0.09, "sine", 0.06);
        tone(1050, 0.09, 0.14, "sine", 0.06);
        break;
      case "hint":
        tone(880, 0, 0.1, "sine", 0.05);
        break;
      case "start":
        tone(392, 0, 0.1, "triangle", 0.06);
        tone(523.25, 0.1, 0.16, "triangle", 0.06);
        break;
    }
  } catch {
    /* audio unavailable */
  }
}

/** Call on first pointer/key interaction to unlock audio on mobile. */
export function unlockAudio(): void {
  ensureCtx();
}
