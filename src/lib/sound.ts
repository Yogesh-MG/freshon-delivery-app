/**
 * Audio + haptic feedback for delivery events.
 *
 * Tones are SYNTHESISED with the Web Audio API rather than shipped as mp3/wav
 * assets. Three reasons that matters here:
 *   - Nothing to bundle, so the OTA payload doesn't grow (the whole bundle is
 *     already ~300 kB gzipped; a usable alert set would add more than that).
 *   - Works with no network and no decode step — riders are often on bad mobile
 *     data, and an offer alert that waits on a fetch is useless.
 *   - No licensing questions about third-party sound packs.
 *
 * Android WebView starts an AudioContext in the "suspended" state until the user
 * interacts with the page, so `unlockAudio()` must run once from a real gesture.
 * Until then every play() call is a silent no-op — by design, not a bug.
 */

export type Cue = "offer" | "success" | "error" | "scan" | "tick";

/** A single oscillator sweep within a cue. */
interface Tone {
  /** Start frequency in Hz. */
  freq: number;
  /** Optional end frequency — the tone glides there over its duration. */
  glideTo?: number;
  /** Offset from the start of the cue, in seconds. */
  at: number;
  /** Tone length in seconds. */
  dur: number;
  /** Peak gain, 0–1. Kept low; several partials stack. */
  gain: number;
  type?: OscillatorType;
}

/**
 * Cue definitions. Kept declarative so the whole sound design is readable in one
 * place and can be tuned without touching the playback code.
 */
const CUES: Record<Cue, Tone[]> = {
  // New trip offer — the one cue that must cut through a pocket. Rising
  // three-note arpeggio (A5→C#6→E6), repeated once, bright square-ish timbre.
  offer: [
    { freq: 880, at: 0.0, dur: 0.13, gain: 0.28, type: "triangle" },
    { freq: 1109, at: 0.13, dur: 0.13, gain: 0.28, type: "triangle" },
    { freq: 1319, at: 0.26, dur: 0.22, gain: 0.32, type: "triangle" },
    { freq: 880, at: 0.5, dur: 0.13, gain: 0.24, type: "triangle" },
    { freq: 1109, at: 0.63, dur: 0.13, gain: 0.24, type: "triangle" },
    { freq: 1319, at: 0.76, dur: 0.26, gain: 0.3, type: "triangle" },
  ],
  // Stop completed / pickup confirmed — warm two-note lift (C6→G6).
  success: [
    { freq: 1047, at: 0.0, dur: 0.1, gain: 0.22, type: "sine" },
    { freq: 1568, at: 0.1, dur: 0.2, gain: 0.22, type: "sine" },
  ],
  // Something failed — low descending buzz, deliberately unpleasant.
  error: [
    { freq: 320, glideTo: 200, at: 0.0, dur: 0.28, gain: 0.25, type: "sawtooth" },
  ],
  // QR read accepted — single short blip, like a supermarket scanner.
  scan: [
    { freq: 2000, at: 0.0, dur: 0.07, gain: 0.2, type: "square" },
  ],
  // Neutral UI acknowledgement.
  tick: [
    { freq: 1200, at: 0.0, dur: 0.04, gain: 0.12, type: "sine" },
  ],
};

/** Vibration patterns (ms on/off), paired with the cue where it makes sense. */
const HAPTICS: Partial<Record<Cue, number[]>> = {
  offer: [0, 220, 120, 220, 120, 380],
  success: [0, 40],
  error: [0, 120, 80, 120],
  scan: [0, 25],
};

let ctx: AudioContext | null = null;
let unlocked = false;
let muted = false;

const MUTE_KEY = "freshon_sound_muted";

if (typeof localStorage !== "undefined") {
  muted = localStorage.getItem(MUTE_KEY) === "1";
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/**
 * Resume the AudioContext from a user gesture. Safe to call repeatedly.
 * Wire this to the first touch/click of the session — see `useSoundUnlock`.
 */
export async function unlockAudio(): Promise<void> {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      return; // Gesture wasn't trusted; the next one will retry.
    }
  }
  unlocked = audio.state === "running";
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* private mode / storage disabled — mute just won't persist */
  }
}

/** Fire the haptic pattern for a cue, if the device supports vibration. */
function vibrate(cue: Cue): void {
  const pattern = HAPTICS[cue];
  if (!pattern) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/**
 * Play a cue. No-ops silently when muted, when audio hasn't been unlocked by a
 * gesture yet, or when Web Audio is unavailable. Haptics still fire when muted —
 * a rider who silences the app usually still wants to feel a new offer.
 */
export function play(cue: Cue): void {
  vibrate(cue);
  if (muted) return;

  const audio = context();
  if (!audio || !unlocked) return;

  const now = audio.currentTime;
  for (const p of CUES[cue]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = p.type ?? "sine";
    osc.frequency.setValueAtTime(p.freq, now + p.at);
    if (p.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(p.glideTo, now + p.at + p.dur);
    }

    // Short attack + exponential release. Ramping to a tiny non-zero value
    // rather than 0 avoids the click exponentialRamp produces at exactly zero.
    gain.gain.setValueAtTime(0.0001, now + p.at);
    gain.gain.exponentialRampToValueAtTime(p.gain, now + p.at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.at + p.dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(now + p.at);
    osc.stop(now + p.at + p.dur + 0.02);
  }
}

/**
 * Repeat the offer cue until stopped — used while a trip offer is on screen and
 * unanswered. Returns a stop function; ALWAYS call it (the offer component does
 * so on unmount) or the rider gets an alert that never ends.
 */
export function startOfferAlert(intervalMs = 3_000): () => void {
  play("offer");
  const id = setInterval(() => play("offer"), intervalMs);
  return () => clearInterval(id);
}
