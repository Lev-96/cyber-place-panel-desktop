// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { defaultSound } from "@/preferences/uiPreferences";
import {
  LIBRARY, MAX_PEAK, PROFILES, gainFor, isAudioBlocked, playFor, previewSound, resetSoundEngineForTests,
  setDeviceSound, setSoundPreferences, stopPreview, unlockAudio,
} from "./soundEngine";

/**
 * The one place notification sounds come from (2026-10-27). The visual
 * notification is never this module's: these tests are about sound only —
 * which, how loud, and never twice for one notification.
 */

interface FakeOsc { type: string; freq: number; started: boolean; stopped: number; peak: number; glide?: number }
const made: FakeOsc[] = [];
let ctxState: "running" | "suspended" = "running";

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  get state() { return ctxState; }
  resume() { return Promise.resolve(); }
  createOscillator() {
    const o: FakeOsc & Record<string, unknown> = {
      type: "sine", freq: 0, started: false, stopped: 0, peak: 0,
      frequency: { setValueAtTime: (f: number) => { o.freq = f; }, exponentialRampToValueAtTime: (f: number) => { o.glide = f; } },
      connect: () => {},
      start: () => { o.started = true; },
      stop: () => { o.stopped++; },
    };
    made.push(o);
    return o;
  }
  createGain() {
    const owner = made[made.length - 1];
    return {
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: (v: number) => { if (v > 0 && owner) owner.peak = Math.max(owner.peak, v); },
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
}

beforeEach(() => {
  made.length = 0;
  ctxState = "running";
  resetSoundEngineForTests();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});
afterEach(() => { stopPreview(); });

const notesOf = (from: number) => made.slice(from).map((o) => ({ type: o.type, freq: o.freq, peak: o.peak }));

describe("the built-in sounds", () => {
  test("the floor chime is the rising three-note arpeggio, as before", () => {
    expect(LIBRARY.chime.map((n) => n.freq)).toEqual([523.25, 659.25, 783.99]);
    expect(LIBRARY.chime.every((n) => n.type === "triangle" && n.peak === 0.18)).toBe(true);
  });

  test("the support sound is two notes stepping DOWN, and softer", () => {
    const [a, b] = LIBRARY.soft;
    expect(b.freq).toBeLessThan(a.freq);
    expect(Math.max(...LIBRARY.soft.map((n) => n.peak))).toBeLessThan(Math.max(...LIBRARY.chime.map((n) => n.peak)));
  });

  test("the modern sounds are there, short, and the pops really slide", () => {
    for (const id of ["pop", "bubble", "glass", "strum", "knock", "marimba"] as const) {
      expect(LIBRARY[id].length).toBeGreaterThan(0);
      expect(Math.max(...LIBRARY[id].map((n) => n.at + n.dur))).toBeLessThan(0.8);
    }
    previewSound("pop", "standard", 100);
    expect(made[0].glide).toBe(420);
  });

  test("at the standard profile no sound is scaled down or clips", () => {
    for (const notes of Object.values(LIBRARY)) {
      expect(notes.reduce((t, n) => t + n.peak, 0)).toBeLessThanOrEqual(MAX_PEAK);
    }
  });

  test("every sound is a different sound", () => {
    const shapes = Object.values(LIBRARY).map((notes) => JSON.stringify(notes));
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

describe("playFor", () => {
  test("a notification sounds once: a replay, a reconnect, a re-render are silent", () => {
    expect(playFor("booking_new", "b1", 1_000)).toBe(true);
    const after = made.length;
    expect(playFor("booking_new", "b1", 5_000)).toBe(false);
    expect(playFor("booking_new", "b1", 60_000)).toBe(false);
    // The ending-soon card stands 15 minutes and is re-read every 30 s: still once.
    expect(playFor("booking_new", "b1", 16 * 60_000)).toBe(false);
    expect(made.length).toBe(after);
  });

  test("two different notifications at once do not pile up; the next one later does sound", () => {
    expect(playFor("booking_new", "a", 1_000)).toBe(true);
    expect(playFor("booking_new", "b", 1_200)).toBe(false);
    expect(playFor("booking_new", "c", 2_000)).toBe(true);
  });

  test("each kind plays its own chosen sound", () => {
    setSoundPreferences(defaultSound());
    playFor("support", "m1", 1_000);
    expect(notesOf(0).map((n) => n.freq)).toEqual(LIBRARY.soft.map((n) => n.freq));
    const from = made.length;
    playFor("session_ending", "n1", 5_000);
    expect(notesOf(from).map((n) => n.freq)).toEqual(LIBRARY.bell.map((n) => n.freq));
  });

  test("a kind switched off, or this computer muted, makes no sound", () => {
    const prefs = defaultSound();
    prefs.categories.guests.enabled = false;
    setSoundPreferences(prefs);
    expect(playFor("guests", "g1", 1_000)).toBe(false);
    setDeviceSound({ volume: 100, muted: true });
    expect(playFor("booking_new", "b9", 5_000)).toBe(false);
    expect(made).toHaveLength(0);
  });

  test("the profiles really differ: quiet is softer, loud is louder and plays twice", () => {
    expect(PROFILES.quiet.gain).toBeLessThan(PROFILES.standard.gain);
    expect(PROFILES.loud.gain).toBeGreaterThan(PROFILES.standard.gain);
    expect(PROFILES.loud.repeat).toBe(2);

    setSoundPreferences({ ...defaultSound(), profile: "loud" });
    playFor("booking_new", "l1", 1_000);
    expect(made).toHaveLength(LIBRARY.chime.length * 2);
    expect(Math.max(...made.map((o) => o.peak))).toBeGreaterThan(0.18);
  });

  test("the standard profile is not scaled down: it sounds as it always did", () => {
    playFor("booking_new", "std", 1_000);
    expect(made.map((o) => o.peak)).toEqual([0.18, 0.18, 0.18]);
  });

  test("loud never clips: a sound's notes together stay under the cap", () => {
    setSoundPreferences({ ...defaultSound(), profile: "loud" });
    playFor("booking_new", "loud-chime", 1_000);
    const firstPass = made.slice(0, LIBRARY.chime.length).reduce((t, o) => t + o.peak, 0);
    expect(firstPass).toBeLessThanOrEqual(MAX_PEAK + 1e-9);
  });

  test("never louder than the cap, and volume is never above 100 %", () => {
    // Even a profile gain far past any real one cannot push a note over the cap.
    const loud = PROFILES.loud.gain;
    PROFILES.loud.gain = 50;
    try {
      setSoundPreferences({ ...defaultSound(), profile: "loud" });
      setDeviceSound({ volume: 250, muted: false });
      playFor("session_ending", "x", 1_000);
      // The SUM of a sound's notes (they overlap) never passes the cap.
      const sum = made.slice(0, LIBRARY.bell.length).reduce((t, o) => t + o.peak, 0);
      expect(sum).toBeLessThanOrEqual(MAX_PEAK + 1e-9);
      expect(sum).toBeGreaterThan(MAX_PEAK - 1e-9);
    } finally {
      PROFILES.loud.gain = loud;
    }
    expect(gainFor("standard", 250)).toBe(1);
    expect(gainFor("standard", 50)).toBe(0.5);
    expect(gainFor("standard", 0)).toBe(0);
  });
});

describe("preview and the system's permission", () => {
  test("one preview at a time: a new one stops the last; Stop stops it", () => {
    // Each note is scheduled with its own stop; a preview cut short is stopped AGAIN, now.
    previewSound("bell", "standard", 100);
    const first = made.slice();
    expect(first.every((o) => o.stopped === 1)).toBe(true);
    previewSound("chime", "standard", 100);
    expect(first.every((o) => o.stopped === 2)).toBe(true);
    const second = made.slice(first.length);
    expect(second.every((o) => o.stopped === 1)).toBe(true);
    stopPreview();
    expect(second.every((o) => o.stopped === 2)).toBe(true);
  });

  test("audio the system has not allowed is said, and allowed again from a click", async () => {
    ctxState = "suspended";
    playFor("booking_new", "z", 1_000);
    expect(isAudioBlocked()).toBe(true);
    ctxState = "running";
    expect(await unlockAudio()).toBe(true);
    expect(isAudioBlocked()).toBe(false);
  });
});
