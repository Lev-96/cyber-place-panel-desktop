import { IBranchPlace, PlatformType, PlaceType } from "@/types/api";
import { Booking } from "./Booking";
import { PlaceLiveStatus } from "./PlaceStatus";

export class Place {
  readonly id: number;
  readonly branchId: number;
  readonly type: PlaceType;
  readonly platform: PlatformType;
  readonly active: boolean;
  readonly raw: IBranchPlace;

  constructor(raw: IBranchPlace) {
    this.raw = raw;
    this.id = raw.id;
    this.branchId = raw.branch_id;
    this.type = raw.type;
    this.platform = raw.platform;
    this.active = raw.status === "active";
  }

  computeStatus(bookings: readonly Booking[], at: Date): PlaceLiveStatus {
    if (!this.active) return "maintenance";
    if (bookings.some((b) => b.isActiveAt(at))) return "busy";
    if (bookings.some((b) => b.isUpcoming(at))) return "reserved";
    return "free";
  }
}
