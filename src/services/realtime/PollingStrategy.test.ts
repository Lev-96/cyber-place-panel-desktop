import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PollingStrategy } from "./PollingStrategy";

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("PollingStrategy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const opts = { activeIntervalMs: 1000, idleIntervalMs: 5000, maxBackoffMs: 30_000 };

  it("calls tick immediately on start", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const s = new PollingStrategy(opts);
    s.start(tick);
    await flush();
    expect(tick).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it("calls tick again after the interval", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const s = new PollingStrategy(opts);
    s.start(tick);
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(tick).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("stop prevents further ticks", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const s = new PollingStrategy(opts);
    s.start(tick);
    await flush();
    s.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate start", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const s = new PollingStrategy(opts);
    s.start(tick);
    s.start(tick); // second call should be a no-op
    await flush();
    expect(tick).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it("uses exponential backoff after a failure", async () => {
    const tick = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const s = new PollingStrategy(opts);
    s.start(tick);
    await flush();
    expect(tick).toHaveBeenCalledTimes(1);

    // After 1 failure: base * 2^1 = 2000ms
    await vi.advanceTimersByTimeAsync(1500);
    await flush();
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(700);
    await flush();
    expect(tick).toHaveBeenCalledTimes(2);
    s.stop();
  });
});
