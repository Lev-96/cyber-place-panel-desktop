// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The two chimes have to be different, and the difference has to be the kind a
 * person hears: an operational event rises, a support message steps down. If
 * they ever converge, the second one gets ignored along with the first — so
 * this pins the shapes rather than the exact frequencies.
 */

interface Scheduled { freq: number; type: string; peak: number }

const scheduled: Scheduled[] = [];

class FakeGain {
  gain = {
    setValueAtTime: () => {},
    linearRampToValueAtTime: (v: number) => { FakeGain.lastPeak = v; },
    exponentialRampToValueAtTime: () => {},
  };
  static lastPeak = 0;
  connect() {}
}

class FakeOsc {
  type = "";
  frequency = { setValueAtTime: (f: number) => { this.freq = f; } };
  freq = 0;
  connect() {}
  start() { scheduled.push({ freq: this.freq, type: this.type, peak: FakeGain.lastPeak }); }
  stop() {}
}

class FakeCtx {
  state = "running";
  currentTime = 0;
  destination = {};
  createOscillator() { return new FakeOsc() as unknown as OscillatorNode; }
  createGain() { return new FakeGain() as unknown as GainNode; }
  resume() { return Promise.resolve(); }
}

beforeEach(() => {
  scheduled.length = 0;
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const load = async () => import("./notificationSound");

describe("notification chimes", () => {
  test("the app chime is the rising three-note arpeggio", async () => {
    const { playNotificationChime } = await load();
    playNotificationChime();

    const freqs = scheduled.map((s) => s.freq);
    expect(freqs).toHaveLength(3);
    expect(freqs[0]).toBeLessThan(freqs[1]);
    expect(freqs[1]).toBeLessThan(freqs[2]);
  });

  test("the support chime is two notes stepping DOWN, and softer", async () => {
    const { playSupportChime } = await load();
    playSupportChime();

    expect(scheduled).toHaveLength(2);
    expect(scheduled[0].freq).toBeGreaterThan(scheduled[1].freq);
    // Sine against the arpeggio's triangle — most of the difference by ear.
    expect(scheduled.every((s) => s.type === "sine")).toBe(true);
    expect(scheduled[0].peak).toBeLessThan(0.18);
  });

  test("the two are not the same sound", async () => {
    const { playNotificationChime, playSupportChime } = await load();

    playNotificationChime();
    const app = scheduled.map((s) => `${s.type}:${s.freq}`).join(",");
    scheduled.length = 0;
    playSupportChime();
    const support = scheduled.map((s) => `${s.type}:${s.freq}`).join(",");

    expect(support).not.toBe(app);
  });

  test("muting silences the support chime too", async () => {
    const { playSupportChime, setNotificationSoundMuted } = await load();
    setNotificationSoundMuted(true);

    playSupportChime();

    expect(scheduled).toHaveLength(0);
    setNotificationSoundMuted(false);
  });
});
