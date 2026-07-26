import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A simple seconds countdown. `start()` (re)sets it to `seconds` and it ticks
 * down to 0. `remaining` is the live value; `active` is true while it's running.
 * The interval is always cleared on unmount. Reusable for resend cooldowns,
 * auto-dismiss timers, etc.
 */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setRemaining(seconds);
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clear();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [seconds, clear]);

  useEffect(() => clear, [clear]);

  return { remaining, active: remaining > 0, start };
}
