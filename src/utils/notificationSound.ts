/**
 * Game-styled notification chime synthesised on the fly via the Web
 * Audio API — no audio asset to ship, no autoplay-blocker headache
 * (the chime only fires from a user-driven event chain that started
 * with the cashier interacting with the desktop). A short three-note
 * arpeggio (C5 → E5 → G5) gives the "coin pickup" feel the cashier
 * floor asked for, while staying short enough to not nag during a
 * busy run.
 *
 * Singleton AudioContext: Chrome / Edge cap the number of concurrent
 * contexts, and re-creating one on every notification leaks them. We
 * resume a suspended context on demand — Electron's renderer hands
 * back a "running" context after first user gesture.
 *
 * Failure-tolerant: any audio error (sandboxed WM, headless display)
 * is swallowed. The OS / in-app notification still fires; the chime
 * is sugar.
 */

type AudioCtxLike = AudioContext;

let ctx: AudioCtxLike | null = null;
let muted = false;

const getCtx = (): AudioCtxLike | null => {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
};

/**
 * Toggle audible notifications globally for the current renderer.
 * Persists nothing — the cashier resets it on next launch, which is
 * the right default (busy shifts shouldn't accidentally inherit a
 * silenced state from yesterday).
 */
export const setNotificationSoundMuted = (next: boolean): void => {
  muted = next;
};

export const isNotificationSoundMuted = (): boolean => muted;

/**
 * Plays the three-note arpeggio. Idempotent and concurrent-safe — two
 * events arriving in the same tick simply layer on each other; the
 * gain envelope keeps the result well under clipping.
 */
export const playNotificationChime = (): void => {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Renderer process audio context can come back suspended after the
  // window has been backgrounded by the OS. resume() is a no-op when
  // already running.
  if (c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }

  const now = c.currentTime;
  // Three-note arpeggio: C5 → E5 → G5 ascending — bright, "you got
  // mail" vibe without being a full jingle.
  const notes: { freq: number; t: number }[] = [
    { freq: 523.25, t: 0 },
    { freq: 659.25, t: 0.09 },
    { freq: 783.99, t: 0.18 },
  ];

  try {
    for (const note of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.freq, now + note.t);
      gain.gain.setValueAtTime(0, now + note.t);
      // Quick attack, gentle decay — keeps each note distinct without
      // muddying the next one.
      gain.gain.linearRampToValueAtTime(0.18, now + note.t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + 0.22);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + 0.25);
    }
  } catch {
    // AudioParam scheduling can throw on a closed context — swallow,
    // chime is best-effort.
  }
};

/**
 * The support chime — deliberately NOT the one above.
 *
 * The arpeggio means "something happened on the floor": a booking, a
 * tournament, the day's operational traffic. A message from support is a
 * person waiting for an answer, and if the two sound alike the second one gets
 * ignored along with the first.
 *
 * So this is the other familiar shape: two notes, a small step apart, the
 * second slightly LOWER — the "incoming message" cadence every chat app uses,
 * where the ascending one is reserved for alerts. Lower and softer than the
 * arpeggio (a sine, peaking at 0.16 rather than 0.18), because it can arrive
 * while somebody is mid-sentence with a customer. Under 300ms end to end.
 *
 * A sine rather than a triangle is most of the difference by ear: no upper
 * harmonics, so it reads as a soft "bloop" against the arpeggio's brighter
 * pluck even at the same pitch.
 */
export const playSupportChime = (): void => {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }

  const now = c.currentTime;
  // G5 → E5: a descending minor third, the interval a chat notification uses.
  const notes: { freq: number; t: number }[] = [
    { freq: 783.99, t: 0 },
    { freq: 659.25, t: 0.11 },
  ];

  try {
    for (const note of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.t);
      gain.gain.setValueAtTime(0, now + note.t);
      gain.gain.linearRampToValueAtTime(0.16, now + note.t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + 0.18);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + 0.2);
    }
  } catch {
    // Same as above: the toast is the notification, the chime is sugar.
  }
};
