import { Booking } from "@/domain/Booking";
import { Place } from "@/domain/Place";
import { PlaceLiveStatus } from "@/domain/PlaceStatus";
import { Service } from "@/domain/Service";
import { AppConfig } from "@/infrastructure/AppConfig";
import { TypedEventEmitter } from "@/infrastructure/TypedEventEmitter";
import { bookingRepository } from "@/repositories/BookingRepository";
import { placeRepository } from "@/repositories/PlaceRepository";
import { serviceRepository } from "@/repositories/ServiceRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IRealtimeStrategy } from "./IRealtimeStrategy";
import { IPlaceAssignmentPolicy, PivotPlaceAssignment } from "./PlaceAssignmentPolicy";
import { PollingStrategy } from "./PollingStrategy";

export interface PlaceSnapshot {
  place: Place;
  status: PlaceLiveStatus;
  bookings: Booking[];
}

export interface BranchSnapshot {
  branchId: number;
  takenAt: Date;
  places: PlaceSnapshot[];
  services: Service[];
  totals: { total: number; free: number; busy: number; reserved: number; maintenance: number };
}

interface Events {
  snapshot: BranchSnapshot;
  error: Error;
}

export class RealtimeService {
  private emitter = new TypedEventEmitter<Events>();
  private strategy: IRealtimeStrategy;
  private last?: BranchSnapshot;

  constructor(
    private branchId: number,
    private assignment: IPlaceAssignmentPolicy = new PivotPlaceAssignment(),
    strategy?: IRealtimeStrategy,
  ) {
    this.strategy = strategy ?? new PollingStrategy({
      activeIntervalMs: AppConfig.realtimePollIntervalMs,
      idleIntervalMs: AppConfig.realtimePollIdleMs,
      maxBackoffMs: AppConfig.realtimePollMaxBackoffMs,
    });
  }

  start() { this.strategy.start(() => this.tick()); }
  stop()  { this.strategy.stop(); }
  refresh() { this.strategy.triggerNow(); }
  current(): BranchSnapshot | undefined { return this.last; }

  on<K extends keyof Events>(e: K, l: (p: Events[K]) => void) { return this.emitter.on(e, l); }

  private async tick(): Promise<void> {
    try {
      // Today + future. Past bookings are filtered out client-side
      // by `Booking.isReservingAt` (end_time has passed), so omitting
      // a `date_to` doesn't add noise. The previous "today only"
      // window silently hid every booking starting tomorrow or later
      // — the cashier would see a green tile and could open a walk-
      // in session minutes before the guest's slot. Pull PCs +
      // active sessions in addition so a running session at place X
      // promotes that place to `busy` (red) on the live board even
      // when no booking covers the slot (walk-in customers).
      const [places, services, bookings, pcs, sessions] = await Promise.all([
        placeRepository.listByBranch(this.branchId),
        serviceRepository.listByBranch(this.branchId),
        bookingRepository.listAll({ branch_id: this.branchId, date_from: todayDMY() }),
        sessionRepository.listPcs(this.branchId),
        sessionRepository.listActive(this.branchId),
      ]);
      const sessionPlaceIds = new Set<number>();
      const pcByPcId = new Map<number, (typeof pcs)[number]>(pcs.map((pc) => [pc.id, pc]));
      for (const s of sessions) {
        const pc = pcByPcId.get(s.pc_id);
        if (pc && pc.place_id != null) sessionPlaceIds.add(pc.place_id);
      }
      const snapshot = this.buildSnapshot(places, services, bookings, sessionPlaceIds);
      this.last = snapshot;
      this.emitter.emit("snapshot", snapshot);
    } catch (e) {
      this.emitter.emit("error", e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  private buildSnapshot(places: Place[], services: Service[], bookings: Booking[], sessionPlaceIds: Set<number>): BranchSnapshot {
    const at = new Date();
    const assigned = this.assignment.assign(places, bookings, at);
    const placeSnapshots: PlaceSnapshot[] = places.map((p) => {
      const list = assigned.get(p.id) ?? [];
      let status = p.computeStatus(list, at);
      // Maintenance always wins (a broken machine isn't "busy"), but for
      // active/free/reserved we promote to busy when a session is running.
      if (status !== "maintenance" && sessionPlaceIds.has(p.id)) status = "busy";
      return { place: p, status, bookings: list };
    });
    const totals = placeSnapshots.reduce(
      (acc, s) => ({ ...acc, total: acc.total + 1, [s.status]: acc[s.status] + 1 }),
      { total: 0, free: 0, busy: 0, reserved: 0, maintenance: 0 },
    );
    return { branchId: this.branchId, takenAt: at, places: placeSnapshots, services, totals };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `d-m-Y` clock-time-of-day stamp — matches the booking
 * `IndexRequest` validator's `date_format:d-m-Y` rule. Local
 * time on purpose: the cashier's machine and the backend's
 * app timezone (Asia/Yerevan) are aligned.
 */
const todayDMY = (): string => {
  const now = new Date();
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
};
