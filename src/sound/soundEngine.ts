import {
  SOUND_DEFAULTS, SYNTH_SOUNDS, defaultSound,
  type FileSoundId, type SoundCategory, type SoundId, type SoundPrefs, type SoundProfile, type SynthSoundId,
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
 * - Two kinds of sound (2026-10-27): the panel's own, synthesised (Web
 *   Audio, nothing to load), and recorded melodies shipped with the panel
 *   (`public/sounds`), loaded once and kept. A recording that cannot be
 *   loaded plays the chime instead: a notification is never silent because
 *   a file was missing.
 * - Long enough to be heard (owner, 2026-10-27): a short recording is played
 *   again until the profile's minimum length is reached.
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
export const LIBRARY: Record<SynthSoundId, Note[]> = {
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

/**
 * The recorded melodies: each file's length in seconds, as measured when it
 * was trimmed and levelled to one loudness (−16 LUFS, peaks under −1.5 dB),
 * so a level of 1 never clips and every melody is equally loud.
 */
export const RECORDINGS: Record<FileSoundId, number> = {
  melodic: 1.34, message: 1.6, arrival: 1.67, newmsg: 0.79, sms: 2.17,
  messenger: 1.32, chat: 0.63, note: 1.2, chord: 1.24, calm: 1.46,
  social: 1.55, woohoo: 1.95, beep: 3.0, digital: 3.0, space: 6.46,
};

/**
 * What each ready-made profile does: real playback differences, not names.
 * `gain` / `repeat` shape the synthesised sounds (as before); `level` and
 * `minSeconds` the recordings — how loud, and how long a notification rings
 * at least (a short melody plays again until it has).
 */
export const PROFILES: Record<Exclude<SoundProfile, "custom">, {
  gain: number; repeat: number; level: number; minSeconds: number;
}> = {
  quiet: { gain: 0.45, repeat: 1, level: 0.4, minSeconds: 0 },
  standard: { gain: 1, repeat: 1, level: 0.75, minSeconds: 3 },
  // Loud / Gaming club: louder, and it rings longer.
  loud: { gain: 2.4, repeat: 2, level: 1, minSeconds: 6 },
};
/** A recording is played at most this many times for one notification. */
export const MAX_PLAYS = 4;
/** Silence between two plays of a recording, in seconds. */
const PLAY_GAP = 0.3;
/** A recording that took longer than this to load is not played late. */
const LATE_MS = 3_000;

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
/** Nothing new starts before this (ms): the sound playing now is not cut or doubled. */
let busyUntil = 0;
const recordings = new Map<FileSoundId, Promise<AudioBuffer | null>>();
const heard = new Map<string, number>();
let blocked = false;
const blockedListeners = new Set<(b: boolean) => void>();

const setBlocked = (b: boolean) => {
  if (b === blocked) return;
  blocked = b;
  for (const l of blockedListeners) { try { l(b); } catch { /* a listener mid-unmount */ } }
};

const isSynth = (id: SoundId): id is SynthSoundId => (SYNTH_SOUNDS as readonly string[]).includes(id);

/** The person's sound choices (the preferences provider keeps this current). */
export const setSoundPreferences = (next: SoundPrefs): void => {
  prefs = next;
  // The melodies this person will hear are loaded now, not at the first
  // notification, so it is not late.
  const c = getCtx();
  if (!c) return;
  for (const choice of Object.values(next.categories)) {
    if (choice.enabled && !isSynth(choice.sound)) void loadRecording(c, choice.sound);
  }
};
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
/** How loud a recording plays (0–1) for a profile at this machine's volume. */
export const levelFor = (profile: SoundProfile, volume: number): number =>
  PROFILES[profile === "custom" ? "standard" : profile].level * (Math.max(0, Math.min(100, volume)) / 100);
/** How many times a recording of this length plays for one notification. */
export const playsFor = (profile: SoundProfile, seconds: number): number => {
  const min = PROFILES[profile === "custom" ? "standard" : profile].minSeconds;
  return Math.max(1, Math.min(MAX_PLAYS, Math.ceil(min / (seconds + PLAY_GAP))));
};
/** How long a sound rings, in ms, start to finish (what `busyUntil` waits for). */
export const soundLengthMs = (id: SoundId, profile: SoundProfile): number => {
  if (isSynth(id)) {
    const notes = LIBRARY[id];
    return (Math.max(...notes.map((n) => n.at + n.dur)) + 0.12) * repeatFor(profile) * 1000;
  }
  const seconds = RECORDINGS[id];
  const plays = playsFor(profile, seconds);
  return (plays * seconds + (plays - 1) * PLAY_GAP) * 1000;
};

/** Load a recording once (kept for the session); null when it cannot be had. */
const loadRecording = (c: AudioContext, id: FileSoundId): Promise<AudioBuffer | null> => {
  let pending = recordings.get(id);
  if (!pending) {
    pending = fetch(new URL(`sounds/${id}.mp3`, document.baseURI).toString())
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        // Forgotten, so the next notification tries again.
        recordings.delete(id);
        return null;
      });
    recordings.set(id, pending);
  }
  return pending;
};

/** Ask a suspended context to run, and say whether audio is allowed. */
const wake = (c: AudioContext) => {
  if (c.state === "suspended") {
    void c.resume().then(() => setBlocked(c.state !== "running")).catch(() => setBlocked(true));
    // Still suspended right after asking: the system has not allowed audio
    // yet (no user gesture). The visual notice carries it; say so.
    if (c.state === "suspended") setBlocked(true);
  } else {
    setBlocked(false);
  }
};

/**
 * Schedule a sound. Returns a stop function (for the preview), or null when
 * nothing could play. Never throws: sound is the least important part of a
 * notification.
 */
const scheduleSynth = (c: AudioContext, id: SynthSoundId, gain: number, repeat: number): (() => void) | null => {
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
 * Play a recording `plays` times at `level`. It may still be loading: the
 * stop function works either way, and a recording that cannot be loaded —
 * or arrives too late to belong to this notification — gives way to the
 * chime, or to nothing when it is late.
 */
const scheduleRecording = (c: AudioContext, id: FileSoundId, level: number, plays: number): () => void => {
  let stopped = false;
  let stopFallback: (() => void) | null = null;
  const sources: AudioBufferSourceNode[] = [];
  const asked = Date.now();
  void loadRecording(c, id).then((buffer) => {
    if (stopped || Date.now() - asked > LATE_MS) return;
    if (!buffer) {
      stopFallback = scheduleSynth(c, "chime", level, 1);
      return;
    }
    try {
      const g = c.createGain();
      g.gain.setValueAtTime(Math.min(1, level), c.currentTime);
      g.connect(c.destination);
      const t0 = c.currentTime + 0.01;
      for (let i = 0; i < plays; i++) {
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.connect(g);
        src.start(t0 + i * (buffer.duration + PLAY_GAP));
        sources.push(src);
      }
    } catch { /* sound is the least important part of a notification */ }
  });
  return () => {
    stopped = true;
    stopFallback?.();
    for (const src of sources) { try { src.stop(); } catch { /* already stopped */ } }
  };
};

/** Start a sound for a profile at a volume. Returns its stop, or null when nothing can play. */
const schedule = (id: SoundId, profile: SoundProfile, volume: number): (() => void) | null => {
  const c = getCtx();
  if (!c) return null;
  if (isSynth(id)) {
    const gain = gainFor(profile, volume);
    if (gain <= 0) return null;
    wake(c);
    return scheduleSynth(c, id, gain, repeatFor(profile));
  }
  const level = levelFor(profile, volume);
  if (level <= 0) return null;
  wake(c);
  return scheduleRecording(c, id, level, playsFor(profile, RECORDINGS[id]));
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
  if (now < busyUntil) return false;
  busyUntil = now + Math.max(SPACING_MS, soundLengthMs(choice.sound, prefs.profile));
  return schedule(choice.sound, prefs.profile, device.volume) !== null;
};

let previewing: (() => void) | null = null;

/** Play a sound to hear it (the settings screen). One at a time; returns its stop. */
export const previewSound = (id: SoundId, profile: SoundProfile, volume: number): (() => void) => {
  stopPreview();
  const stop = schedule(id, profile, volume);
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
  busyUntil = 0;
  recordings.clear();
  previewing = null;
  blocked = false;
  ctx = null;
  prefs = defaultSound();
  device = { volume: 100, muted: false };
};
