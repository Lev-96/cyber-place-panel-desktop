import { Booking } from "@/domain/Booking";
import { bookingRepository } from "@/repositories/BookingRepository";
import { useEffect, useState } from "react";

const toDMY = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/**
 * The booking holding each reserved seat (2026-11-07) — who is coming, their
 * phone, and the id «Пришёл» and «Отменить бронь» act on.
 *
 * WHICH seats are reserved stays `useReservedPlaceIds`' answer (its snapshot,
 * realtime delta and ordering); this only reads the details again whenever
 * that set changes, so the two never disagree about a seat for long and the
 * set's realtime path is not duplicated here.
 */
export const useReservationsByPlace = (branchId: number, reservedIds: Set<number>): Map<number, Booking> => {
  const [byPlace, setByPlace] = useState<Map<number, Booking>>(new Map());
  const key = [...reservedIds].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!Number.isFinite(branchId) || key === "") {
      setByPlace(new Map());
      return;
    }
    let live = true;
    const now = new Date();
    bookingRepository.listAll({ branch_id: branchId, date_from: toDMY(now) })
      .then((bookings) => {
        if (!live) return;
        const map = new Map<number, Booking>();
        for (const b of bookings) {
          if (!b.isReservingAt(now)) continue;
          for (const id of b.placeIds) if (!map.has(id)) map.set(id, b);
        }
        setByPlace(map);
      })
      .catch(() => { /* the tile still says reserved; details come with the next change */ });
    return () => { live = false; };
  }, [branchId, key]);

  return byPlace;
};
