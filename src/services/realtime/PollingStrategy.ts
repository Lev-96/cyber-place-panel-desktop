import { logger } from "@/infrastructure/Logger";
import { IRealtimeStrategy, Tick } from "./IRealtimeStrategy";

export interface PollingOptions {
  activeIntervalMs: number;
  idleIntervalMs: number;
  maxBackoffMs: number;
}

export class PollingStrategy implements IRealtimeStrategy {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private running = false;
  private tick: Tick | null = null;
  private docHidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  constructor(private options: PollingOptions) {}

  start(tick: Tick): void {
    if (this.running) return;
    this.tick = tick;
    this.running = true;
    this.failures = 0;
    void this.run();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.tick = null;
  }

  triggerNow(): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    void this.run();
  }

  private async run() {
    if (!this.running || !this.tick) return;
    try {
      await this.tick();
      this.failures = 0;
    } catch (e) {
      this.failures += 1;
      logger.warn("polling tick failed", e);
    }
    if (!this.running) return;
    this.timer = setTimeout(() => this.run(), this.nextDelay());
  }

  private nextDelay(): number {
    const base = this.docHidden() ? this.options.idleIntervalMs : this.options.activeIntervalMs;
    if (this.failures === 0) return base;
    return Math.min(base * 2 ** this.failures, this.options.maxBackoffMs);
  }
}
