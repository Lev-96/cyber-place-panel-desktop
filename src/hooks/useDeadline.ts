import { useEffect, useState } from "react";

/**
 * Seconds left until a deadline the SERVER gave as "seconds from now"
 * (2026-10-07: a sign-in lock's `retry_after`). The deadline is fixed against
 * this machine's monotonic clock the moment the answer arrives, so a wrong
 * wall clock on the computer cannot stretch or shorten it, and a tab that was
 * in the background catches up instead of drifting. Only a display: the
 * server decides on the next attempt whether it may go through.
 *
 * `seconds` null means nothing to count. Changing `startedAt` restarts it.
 */
export const useDeadline = (seconds: number | null, startedAt: number): number | null => {
  const compute = () =>
    seconds === null ? null : Math.max(0, Math.ceil(seconds - (performance.now() - startedAt) / 1000));
  const [left, setLeft] = useState<number | null>(compute);

  useEffect(() => {
    setLeft(compute());
    if (seconds === null) return;
    const id = window.setInterval(() => {
      const next = compute();
      setLeft(next);
      if (next === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, startedAt]);

  return left;
};
