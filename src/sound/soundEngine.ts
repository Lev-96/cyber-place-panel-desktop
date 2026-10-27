import {
  SOUND_DEFAULTS, defaultSound,
  type SoundCategory, type SoundId, type SoundPrefs, type SoundProfile,
} from "@/preferences/uiPreferences";

/**
 * Every notification sound the panel makes, in one place (2026-10-27).
 *
 * It used to be three synthesisers with their volume written into each: the
 * floor arpeggio, the support "bloop" and the update ding. Now every call
 * site asks for a KIND of notification (`playFor`), and this decides — from
 * the person's profile, their choice for that kind and this machine's volume —
 * which sound, how loud, and whether at all.
 *
 * What it never does: receive, store or show a notification. Delivery stays
 * exactly where it was (Reverb, the 60-second poll, the toasts and cards);
 * this only turns an arrival that already happened into sound. So a muted or
 * blocked sound never hides anything: the visual notice is the notification.
 *
 * - One sound per notification: a key heard in the last hour is not heard
 *   again (a replayed event, a reconnect, a re-render).
 * - No pile-up: within 700 ms of the last sound nothing else starts.
 * - Never above 100 %: the gain is capped and the system volume is never
 *   touched — how loud 100 % is depends on the machine and its speakers.
 * - Synthesised (Web Audio), no files: nothing to load, nothing to fail.
 */

interface Note {
  freq: number;
  /** Start, in seconds after the sound begins. */
  at: number;
  dur: number;
  type: OscillatorType;
  /** Peak gain at the Standard profile and 100 % volume. */
  peak: number;
  /** "exp": quick attack, exponential decay; "lin": linear in and out. */
  shape: "exp" | "lin";
}

/**
 * The built-in sounds. The first three are the panel's own, note for note,
 * so the Standard profile sounds exactly as before.
 */
export const LIBRARY: Record<SoundId, Note[]> = {
  // The floor arpeggio (C5 → E5 → G5), formerly `playNotificationChime`.
  chime: [
    { freq: 523.25, at: 0, dur: 0.22, type: "triangle", peak: 0.18, shape: "exp" },
    { freq: 659.25, at: 0.09, dur: 0.22, type: "triangle", peak: 0.18, shape: "exp" },
    { freq: 783.99, at: 0.18, dur: 0.22, type: "triangle", peak: 0.18, shape: "exp" },
  ],
  // The support "bloop" (G5 → E5), formerly `playSupportChime`.
  soft: [
    { freq: 783.99, at: 0, dur: 0.18, type: "sine", peak: 0.16, shape: "exp" },
    { freq: 659.25, at: 0.11, dur: 0.18, type: "sine", peak: 0.16, shape: "exp" },
  ],
  // The update ding (E5 → A5), formerly UpdatesToast's `playDing`.
  ding: [
    { freq: 660, at: 0, dur: 0.18, type: "sine", peak: 0.18, shape: "lin" },
    { freq: 880, at: 0.13, dur: 0.22, type: "sine", peak: 0.18, shape: "lin" },
  ],
  // A struck bell: long ring, two partials — carries over a room.
  bell: [
    { freq: 1318.51, at: 0, dur: 0.9, type: "sine", peak: 0.2, shape: "exp" },
    { freq: 1975.53, at: 0, dur: 0.6, type: "sine", peak: 0.08, shape: "exp" },
    { freq: 1318.51, at: 0.28, dur: 0.9, type: "sine", peak: 0.16, shape: "exp" },
  ],
  // Three short pulses at A5: noticeable without being alarming.
  pulse: [
    { freq: 880, at: 0, dur: 0.09, type: "square", peak: 0.09, shape: "exp" },
    { freq: 880, at: 0.14, dur: 0.09, type: "square", peak: 0.09, shape: "exp" },
    { freq: 880, at: 0.28, dur: 0.09, type: "square", peak: 0.09, shape: "exp" },
  ],
  // Two-tone alert (B5 / F#5 twice): for what needs attention now.
  alert: [
    { freq: 987.77, at: 0, dur: 0.16, type: "sawtooth", peak: 0.07, shape: "lin" },
    { freq: 739.99, at: 0.18, dur: 0.16, type: "sawtooth", peak: 0.07, shape: "lin" },
    { freq: 987.77, at: 0.36, dur: 0.16, type: "sawtooth", peak: 0.07, shape: "lin" },
    { freq: 739.99, at: 0.54, dur: 0.16, type: "sawtooth", peak: 0.07, shape: "lin" },
  ],
};

/** What each ready-made profile does: real playback differences, not names. */
export const PROFILES: Record<Exclude<SoundProfile, "custom">, { gain: number; repeat: number }> = {
  quiet: { gain: 0.45, repeat: 1 },
  standard: { gain: 1, repeat: 1 },
  // Loud / Gaming club: louder, and the sound plays twice.
  loud: { gain: 2.4, repeat: 2 },
};

/** Never louder than this, whatever the profile: a clean signal, not clipping. */
export const MAX_PEAK = 0.9;
/**
 * How long a notification key stays "heard". Longer than any notice lives on
 * screen: the ending-soon card stands for up to 15 minutes and is re-read
 * every 30 seconds, so a shorter memory rang it a second time (review,
 * 2026-10-27).
 */
const DEDUP_MS = 60 * 60_000;
const SPACING_MS = 700;

/** This machine's own volume and mute (not the person's — speakers differ). */
export interface DeviceSound {
  /** 0–100. */
  volume: number;
  muted: boolean;
}

let prefs: SoundPrefs = defaultSound();
let device: DeviceSound = { volume: 100, muted: false };
let ctx: AudioContext | null = null;
let lastAt = 0;
const heard = new Map<string, number>();
let blocked = false;
const blockedListeners = new Set<(b: boolean) => void>();

const setBlocked = (b: boolean) => {
  if (b === blocked) return;
  blocked = b;
  for (const l of blockedListeners) { try { l(b); } catch { /* a listener mid-unmount */ } }
};

/** The person's sound choices (the preferences provider keeps this current). */
export const setSoundPreferences = (next: SoundPrefs): void => { prefs = next; };
/** This machine's volume and mute. */
export const setDeviceSound = (next: DeviceSound): void => {
  device = { volume: Math.max(0, Math.min(100, Math.round(next.volume))), muted: next.muted };
};
export const getDeviceSound = (): DeviceSound => device;

/** Whether the system refused to start audio (autoplay policy, no device). */
export const isAudioBlocked = (): boolean => blocked;
export const onAudioBlockedChange = (l: (b: boolean) => void): (() => void) => {
  blockedListeners.add(l);
  return () => { blockedListeners.delete(l); };
};

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
};

/** The gain multiplier for a profile at this machine's volume. */
export const gainFor = (profile: SoundProfile, volume: number): number => {
  const base = profile === "custom" ? 1 : PROFILES[profile].gain;
  return base * (Math.max(0, Math.min(100, volume)) / 100);
};
export const repeatFor = (profile: SoundProfile): number => (profile === "custom" ? 1 : PROFILES[profile].repeat);

/**
 * Schedule a sound. Returns a stop function (for the preview), or null when
 * nothing could play. Never throws: sound is the least important part of a
 * notification.
 */
const schedule = (id: SoundId, gain: number, repeat: number): (() => void) | null => {
  const c = getCtx();
  if (!c || gain <= 0) return null;
  if (c.state === "suspended") {
    void c.resume().then(() => setBlocked(c.state !== "running")).catch(() => setBlocked(true));
    // Still suspended right after asking: the system has not allowed audio
    // yet (no user gesture). The visual notice carries it; say so.
    if (c.state === "suspended") setBlocked(true);
  } else {
    setBlocked(false);
  }
  const notes = LIBRARY[id];
  const length = Math.max(...notes.map((n) => n.at + n.dur)) + 0.12;
  // The notes of a sound overlap, so the cap is on their SUM, not on each:
  // three chime notes at 0.43 each would add up past full scale and clip.
  const total = notes.reduce((sum, n) => sum + n.peak, 0) * gain;
  const scale = total > MAX_PEAK ? MAX_PEAK / total : 1;
  const oscillators: OscillatorNode[] = [];
  try {
    const t0 = c.currentTime + 0.01;
    for (let r = 0; r < repeat; r++) {
      const offset = t0 + r * (length + 0.08);
      for (const n of notes) {
        const osc = c.createOscillator();
        const g = c.createGain();
        const peak = n.peak * gain * scale;
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, offset + n.at);
        g.gain.setValueAtTime(0, offset + n.at);
        if (n.shape === "exp") {
          g.gain.linearRampToValueAtTime(peak, offset + n.at + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, offset + n.at + n.dur);
        } else {
          g.gain.linearRampToValueAtTime(peak, offset + n.at + 0.02);
          g.gain.linearRampToValueAtTime(0, offset + n.at + n.dur);
        }
        osc.connect(g);
        g.connect(c.destination);
        osc.start(offset + n.at);
        osc.stop(offset + n.at + n.dur + 0.03);
        oscillators.push(osc);
      }
    }
  } catch {
    return null;
  }
  return () => {
    for (const o of oscillators) { try { o.stop(); } catch { /* already stopped */ } }
  };
};

/**
 * A notification of this kind has ARRIVED and is being shown: sound it, once.
 * `key` identifies the notification (its id, or the event's identity) so a
 * second arrival of the same one — replay, reconnect, re-render — is silent.
 * Returns whether a sound was started.
 */
export const playFor = (category: SoundCategory, key: string, now: number = Date.now()): boolean => {
  const k = `${category}:${key}`;
  for (const [old, at] of heard) if (now - at > DEDUP_MS) heard.delete(old);
  if (heard.has(k)) return false;
  heard.set(k, now);
  if (heard.size > 500) heard.delete(heard.keys().next().value as string);

  const choice = prefs.categories[category] ?? SOUND_DEFAULTS[category];
  if (!choice.enabled || device.muted) return false;
  if (now - lastAt < SPACING_MS) return false;
  lastAt = now;
  return schedule(choice.sound, gainFor(prefs.profile, device.volume), repeatFor(prefs.profile)) !== null;
};

let previewing: (() => void) | null = null;

/** Play a sound to hear it (the settings screen). One at a time; returns its stop. */
export const previewSound = (id: SoundId, profile: SoundProfile, volume: number): (() => void) => {
  stopPreview();
  const stop = schedule(id, gainFor(profile, volume), repeatFor(profile));
  previewing = stop;
  return () => { if (previewing === stop) stopPreview(); };
};

export const stopPreview = (): void => {
  previewing?.();
  previewing = null;
};

/** Ask the system to allow audio now — call from a click. */
export const unlockAudio = async (): Promise<boolean> => {
  const c = getCtx();
  if (!c) return false;
  try { await c.resume(); } catch { /* still blocked */ }
  setBlocked(c.state !== "running");
  return c.state === "running";
};

/** Test-only: forget everything heard and the spacing clock. */
export const resetSoundEngineForTests = (): void => {
  heard.clear();
  lastAt = 0;
  previewing = null;
  blocked = false;
  ctx = null;
  prefs = defaultSound();
  device = { volume: 100, muted: false };
};
