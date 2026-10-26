import { useEffect, useState } from "react";

/**
 * The current minute, as a number that changes once a minute while `on`
 * (2026-10-26). For a figure that depends on "now" — a plan "until 00:40"
 * is shorter every minute — so it is asked of the server again rather than
 * shown stale. Off, it never ticks.
 */
export const useMinuteTick = (on: boolean): number => {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));

  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 60_000);
      setMinute((cur) => (cur === now ? cur : now));
    }, 5_000);
    return () => clearInterval(timer);
  }, [on]);

  return minute;
};
