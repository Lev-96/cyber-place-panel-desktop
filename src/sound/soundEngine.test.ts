// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FILE_SOUNDS, SOUND_DEFAULTS, defaultSound, type SoundPrefs } from "@/preferences/uiPreferences";
import {
  LIBRARY, MAX_PEAK, MAX_PLAYS, PROFILES, RECORDINGS, gainFor, isAudioBlocked, levelFor, playFor, playsFor,
  previewSound, resetSoundEngineForTests, setDeviceSound, setSoundPreferences, stopPreview, unlockAudio,
} from "./soundEngine";

/**
 * The one place notification sounds come from (2026-10-27). The visual
 * notification is never this module's: these tests are about sound only —
 * which, how loud, and never twice for one notification.
 */

interface FakeOsc { type: string; freq: number; started: boolean; stopped: number; peak: number }
interface FakeSource { buffer: unknown; at: number; stopped: number }
const made: FakeOsc[] = [];
const sources: FakeSource[] = [];
const levels: number[] = [];
let ctxState: "running" | "suspended" = "running";
/** What fetch answers for a recording: a body, a 404, or a promise held open. */
let answer: () => Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> }>;
const fetched: string[] = [];
const ok = () => Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
const flush = () => new Promise((r) => setTimeout(r, 0));

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  get state() { return ctxState; }
  resume() { return Promise.resolve(); }
  createOscillator() {
    const o: FakeOsc & Record<string, unknown> = {
      type: "sine", freq: 0, started: false, stopped: 0, peak: 0,
      frequency: { setValueAtTime: (f: number) => { o.freq = f; } },
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
        setValueAtTime: (v: number) => { if (v > 0) levels.push(v); },
        linearRampToValueAtTime: (v: number) => { if (v > 0 && owner) owner.peak = Math.max(owner.peak, v); },
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
  decodeAudioData() { return Promise.resolve({ duration: 1.34 }); }
  createBufferSource() {
    const src: FakeSource & Record<string, unknown> = {
      buffer: null, at: -1, stopped: 0,
      connect: () => {},
      start: (at: number) => { src.at = at; },
      stop: () => { src.stopped++; },
    };
    sources.push(src);
    return src;
  }
}

/** The panel's own synthesised sounds per kind — the sounds as they were before the melodies. */
const SYNTH: SoundPrefs = {
  profile: "standard",
  categories: {
    booking_new: { enabled: true, sound: "chime" },
    booking_changed: { enabled: true, sound: "chime" },
    session_ending: { enabled: true, sound: "bell" },
    support: { enabled: true, sound: "soft" },
    guests: { enabled: true, sound: "chime" },
    system: { enabled: true, sound: "ding" },
  },
};
const synth = (profile: SoundPrefs["profile"] = "standard"): SoundPrefs => ({ ...structuredClone(SYNTH), profile });

beforeEach(() => {
  made.length = 0;
  sources.length = 0;
  levels.length = 0;
  fetched.length = 0;
  ctxState = "running";
  answer = ok;
  resetSoundEngineForTests();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  vi.stubGlobal("fetch", vi.fn((url: string) => { fetched.push(url); return answer(); }));
});
afterEach(() => { stopPreview(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

describe("the recorded melodies", () => {
  test("every melody the person can choose is shipped with the panel, with its length known", () => {
    expect(Object.keys(RECORDINGS).sort()).toEqual([...FILE_SOUNDS].sort());
    for (const id of FILE_SOUNDS) {
      expect(existsSync(resolve(__dirname, "../../public/sounds", `${id}.mp3`))).toBe(true);
      expect(RECORDINGS[id]).toBeGreaterThan(0.3);
    }
  });

  test("by default every kind rings its own melody, so they are told apart by ear", () => {
    const chosen = Object.values(SOUND_DEFAULTS).map((c) => c.sound);
    expect(chosen.every((id) => (FILE_SOUNDS as readonly string[]).includes(id))).toBe(true);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  test("a melody plays from its file, again until it has rung long enough, at the profile's level", async () => {
    setSoundPreferences(defaultSound());
    expect(playFor("booking_new", "r1", 1_000)).toBe(true);
    await flush();
    expect(fetched.some((u) => u.endsWith("/sounds/melodic.mp3"))).toBe(true);
    // 1.34 s is short of the standard 3 s: it plays twice, one after the other.
    expect(sources).toHaveLength(playsFor("standard", RECORDINGS.melodic));
    expect(sources).toHaveLength(2);
    expect(sources[1].at).toBeGreaterThan(sources[0].at + 1.34);
    expect(levels).toContain(levelFor("standard", 100));
    expect(made).toHaveLength(0);
  });

  test("loud rings longer and louder, quiet once and softer; never more than the cap, never above full scale", () => {
    expect(playsFor("quiet", RECORDINGS.chat)).toBe(1);
    expect(playsFor("loud", RECORDINGS.melodic)).toBeGreaterThan(playsFor("standard", RECORDINGS.melodic));
    expect(playsFor("loud", RECORDINGS.chat)).toBe(MAX_PLAYS);
    // A long melody is not repeated to fill a minimum it already passes.
    expect(playsFor("loud", RECORDINGS.space)).toBe(1);
    expect(levelFor("quiet", 100)).toBeLessThan(levelFor("standard", 100));
    expect(levelFor("loud", 100)).toBeLessThanOrEqual(1);
    expect(levelFor("loud", 250)).toBeLessThanOrEqual(1);
    expect(levelFor("custom", 100)).toBe(levelFor("standard", 100));
  });

  test("a melody that cannot be loaded plays the chime instead — never silence", async () => {
    answer = () => Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.reject(new Error("none")) });
    setSoundPreferences(defaultSound());
    playFor("booking_new", "r404", 1_000);
    await flush();
    expect(sources).toHaveLength(0);
    expect(made.map((o) => o.freq)).toEqual(LIBRARY.chime.map((n) => n.freq));
    // …and the next notification asks for the file again.
    answer = ok;
    const before = fetched.length;
    playFor("booking_new", "r-again", 60_000);
    expect(fetched.length).toBe(before + 1);
  });

  test("a preview stopped while its melody is still loading never starts", async () => {
    let release!: () => void;
    answer = () => new Promise((r) => { release = () => r({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); });
    previewSound("space", "standard", 100);
    stopPreview();
    release();
    await flush();
    expect(sources).toHaveLength(0);
  });

  test("a melody that arrives too late for its notification is not played late", async () => {
    // Only this one file is asked for, and its answer is held.
    let release!: () => void;
    answer = () => new Promise((r) => { release = () => r({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); });
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    previewSound("space", "standard", 100);
    expect(fetched).toHaveLength(1);
    // It comes 4 s later: too late to belong to what was asked for.
    now.mockReturnValue(14_000);
    release();
    await flush();
    expect(sources).toHaveLength(0);
    // The same file answering in time does play.
    now.mockReturnValue(20_000);
    previewSound("space", "standard", 100);
    await flush();
    expect(sources.length).toBeGreaterThan(0);
  });

  test("the melodies a person will hear are loaded ahead, the switched-off ones are not", () => {
    const prefs = defaultSound();
    prefs.categories.guests.enabled = false;
    setSoundPreferences(prefs);
    expect(fetched.some((u) => u.endsWith("/sounds/melodic.mp3"))).toBe(true);
    expect(fetched.some((u) => u.endsWith(`/sounds/${SOUND_DEFAULTS.guests.sound}.mp3`))).toBe(false);
  });

  test("nothing new starts while a melody is still ringing; after it, it does", () => {
    setSoundPreferences(defaultSound());
    // melodic, standard: 2 × 1.34 s + 0.3 s ≈ 2.98 s.
    expect(playFor("booking_new", "a", 1_000)).toBe(true);
    expect(playFor("booking_changed", "b", 3_500)).toBe(false);
    expect(playFor("booking_changed", "c", 4_100)).toBe(true);
  });
});

describe("playFor", () => {
  beforeEach(() => setSoundPreferences(synth()));

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
    playFor("support", "m1", 1_000);
    expect(notesOf(0).map((n) => n.freq)).toEqual(LIBRARY.soft.map((n) => n.freq));
    const from = made.length;
    playFor("session_ending", "n1", 5_000);
    expect(notesOf(from).map((n) => n.freq)).toEqual(LIBRARY.bell.map((n) => n.freq));
  });

  test("a kind switched off, or this computer muted, makes no sound", () => {
    const prefs = synth();
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

    setSoundPreferences(synth("loud"));
    playFor("booking_new", "l1", 1_000);
    expect(made).toHaveLength(LIBRARY.chime.length * 2);
    expect(Math.max(...made.map((o) => o.peak))).toBeGreaterThan(0.18);
  });

  test("the standard profile is not scaled down: it sounds as it always did", () => {
    playFor("booking_new", "std", 1_000);
    expect(made.map((o) => o.peak)).toEqual([0.18, 0.18, 0.18]);
  });

  test("loud never clips: a sound's notes together stay under the cap", () => {
    setSoundPreferences(synth("loud"));
    playFor("booking_new", "loud-chime", 1_000);
    const firstPass = made.slice(0, LIBRARY.chime.length).reduce((t, o) => t + o.peak, 0);
    expect(firstPass).toBeLessThanOrEqual(MAX_PEAK + 1e-9);
  });

  test("never louder than the cap, and volume is never above 100 %", () => {
    // Even a profile gain far past any real one cannot push a note over the cap.
    const loud = PROFILES.loud.gain;
    PROFILES.loud.gain = 50;
    try {
      setSoundPreferences(synth("loud"));
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
