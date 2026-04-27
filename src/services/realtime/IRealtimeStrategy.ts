export type Tick = () => Promise<void>;

export interface IRealtimeStrategy {
  start(tick: Tick): void;
  stop(): void;
  triggerNow(): void;
}
