import { Booking } from "@/domain/Booking";
import { Place } from "@/domain/Place";

export interface IPlaceAssignmentPolicy {
  assign(places: readonly Place[], bookings: readonly Booking[], at: Date): Map<number, Booking[]>;
}

export class PlatformAwareSequentialAssignment implements IPlaceAssignmentPolicy {
  assign(places: readonly Place[], bookings: readonly Booking[], at: Date): Map<number, Booking[]> {
    const map = new Map<number, Booking[]>();
    const activePlaces = places.filter((p) => p.active);
    const relevant = bookings.filter((b) => b.isActiveAt(at) || b.isUpcoming(at));
    const sorted = [...relevant].sort((a, b) => a.start.getTime() - b.start.getTime());

    const used = new Set<number>();
    for (const b of sorted) {
      const seats = b.placeCount;
      const matching = activePlaces.filter((p) => !used.has(p.id) && (!b.platform || p.platform === b.platform));
      const taken = matching.slice(0, seats);
      for (const p of taken) {
        used.add(p.id);
        const list = map.get(p.id) ?? [];
        list.push(b);
        map.set(p.id, list);
      }
    }
    return map;
  }
}
