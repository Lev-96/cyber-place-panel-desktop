import type { IStartOptions } from "@/api/sessions";
import { sessionRepository } from "@/repositories/SessionRepository";
import { useCallback, useEffect, useState } from "react";

/**
 * The server's advice for a start on this seat (2026-11-07): how long a new
 * session may run before a reservation, whether unlimited is possible, and
 * which reservations it may fulfil. Asked again when the chosen reservation
 * changes (that one is not counted against the start) and on `reload()`
 * (after a refusal). While asking, the previous answer stays; a failed read
 * leaves `options` null and the start to the server, which re-checks it all.
 */
export const useStartOptions = (pcId: number, bookingId: number | undefined) => {
  const [options, setOptions] = useState<IStartOptions | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    sessionRepository.startOptions(pcId, bookingId)
      .then((o) => { if (live) setOptions(o); })
      .catch(() => { if (live) setOptions(null); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [pcId, bookingId, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { options, loaded, reload };
};
