import { ps5Bridge, type Ps5Console, type Ps5State } from "@/ps5/usePs5Discovery";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep an eye on the consoles this branch has bound, from this machine.
 *
 * The board has to say whether a console is awake, resting or simply not
 * there, and nothing else in the system can answer that: the backend is in a
 * datacentre and the console only speaks to its own local network. So the
 * panel asks, on a timer, and what it learns stays local to the panel that
 * asked.
 *
 * ## Why unicast, and why a sweep anyway
 * The tick sends one datagram per known address. A broadcast every ten seconds
 * would put a packet in front of every device in the club all shift to learn
 * the state of two consoles, which is a poor trade and exactly the kind of
 * traffic a venue's wifi does not need.
 *
 * But an address is a DHCP lease, not an identity. When a console stops
 * answering at the address we have, the honest reading is "either it is off,
 * or it moved" — and those must not look the same. After a couple of silent
 * ticks the watcher falls back to one full sweep, which finds the console by
 * its `host-id` wherever it went, and reports the new address so the caller can
 * remember it.
 */

/** Ten seconds — how often a console with a session running is checked. */
export const WATCH_INTERVAL_MS = 10_000;

/**
 * How often a console that SHOULD be asleep is checked.
 *
 * This is the state where the interesting thing is somebody pressing the
 * console's own power button, and the owner is meant to be asked about it at
 * once. Ten seconds of silence before the question appears is most of what
 * "it does not notify me straight away" was. A unicast datagram costs a console
 * about a hundred and thirty milliseconds to answer, so asking every three
 * seconds is nothing to a venue's network and the difference between "at once"
 * and "eventually" to the person watching.
 */
export const WATCH_INTERVAL_WATCHFUL_MS = 3_000;

/**
 * How often to ask while something is expected to change.
 *
 * A console that has just been told to wake, or to sleep, changes state within
 * a few seconds — and until the next observation the screen keeps showing what
 * was true before the command. Ten seconds of that reads as "nothing is
 * happening", which is what an operator standing at the counter reports.
 */
export const WATCH_INTERVAL_FAST_MS = 1_500;

/**
 * How long the fast rhythm lasts before the ten-second one returns.
 *
 * Long enough to cover a console waking (a few seconds) or going to rest, short
 * enough that a console which is not going to obey does not get asked forty
 * times a minute for the rest of the shift.
 */
export const WATCH_FAST_WINDOW_MS = 20_000;

/**
 * Silent ticks before the watcher stops trusting the address it has and
 * sweeps. Two, so a single dropped datagram (which UDP is entitled to) costs a
 * slower answer rather than a network-wide broadcast.
 */
const MISSES_BEFORE_SWEEP = 2;

export interface WatchedConsole {
  hostId: string;
  /** Last known address, or null when nobody has ever seen it answer. */
  address: string | null;
}

export interface ConsoleStatus {
  state: Ps5State;
  address: string | null;
  name: string | null;
}

interface Options {
  intervalMs?: number;
  /** How often to ask while a change is expected. */
  fastIntervalMs?: number;
  /**
   * Called when a console turns up at an address other than the one we had.
   * The caller decides whether that is worth persisting — the watcher itself
   * never writes anything.
   */
  onAddressChanged?: (hostId: string, address: string) => void;
}

/**
 * @param bound  The consoles to watch. An empty list starts no timer at all.
 */
export const useConsoleWatch = (bound: WatchedConsole[], options: Options = {}) => {
  const { intervalMs = WATCH_INTERVAL_MS, fastIntervalMs = WATCH_INTERVAL_FAST_MS } = options;
  const [statuses, setStatuses] = useState<Record<string, ConsoleStatus>>({});

  // The watched set as a value, not an identity: callers build this array
  // inline from a fetched list, so it is a new array on every render and
  // depending on it directly would restart the timer forever.
  const key = bound.map((c) => `${c.hostId}@${c.address ?? ""}`).sort().join(",");

  // Everything the tick needs but must not restart for.
  const boundRef = useRef(bound);
  boundRef.current = bound;
  const onAddressChanged = useRef(options.onAddressChanged);
  onAddressChanged.current = options.onAddressChanged;
  /** Consecutive silent ticks per host id — the sweep trigger. */
  const misses = useRef<Record<string, number>>({});
  /** Addresses learned since mount, which are fresher than the props. */
  const learned = useRef<Record<string, string>>({});
  /**
   * Until when to ask quickly, because something was just asked to change.
   *
   * A moment rather than a flag: it lapses on its own, so a console that never
   * obeys cannot leave the panel polling it for the rest of the day.
   */
  const fastUntil = useRef(0);
  /** Wakes the loop out of its wait, for when there is no reason to wait. */
  const wakeLoop = useRef<(() => void) | null>(null);

  const tick = useCallback(async () => {
    const api = ps5Bridge();
    const watched = boundRef.current;
    if (!api?.probe || watched.length === 0) return;

    const addressOf = (c: WatchedConsole) => learned.current[c.hostId] ?? c.address;
    const answers = new Map<string, Ps5Console>();

    const direct = await api.probe(
      watched.map(addressOf).filter((a): a is string => Boolean(a)),
    );
    for (const console_ of direct.consoles) answers.set(console_.hostId, console_);

    // Anything we did not hear from at the address we hold. A console with no
    // address at all has never been located and counts as missing from the
    // first tick — that is what makes a freshly bound console findable.
    const missing = watched.filter((c) => !answers.has(c.hostId));
    for (const c of missing) misses.current[c.hostId] = (misses.current[c.hostId] ?? 0) + 1;
    for (const c of watched) if (answers.has(c.hostId)) misses.current[c.hostId] = 0;

    const needsSweep = missing.some((c) => (misses.current[c.hostId] ?? 0) >= MISSES_BEFORE_SWEEP);
    if (needsSweep) {
      const swept = await api.discover();
      for (const console_ of swept.consoles) {
        if (!watched.some((c) => c.hostId === console_.hostId)) continue;
        answers.set(console_.hostId, console_);
        misses.current[console_.hostId] = 0;

        const had = addressOf({ hostId: console_.hostId, address: null })
          ?? watched.find((c) => c.hostId === console_.hostId)?.address
          ?? null;
        if (console_.address && console_.address !== had) {
          learned.current[console_.hostId] = console_.address;
          onAddressChanged.current?.(console_.hostId, console_.address);
        }
      }
    }

    setStatuses(() => {
      const next: Record<string, ConsoleStatus> = {};
      for (const c of watched) {
        const answer = answers.get(c.hostId);
        next[c.hostId] = answer
          ? { state: answer.state, address: answer.address, name: answer.name }
          // Off, unplugged, or on another network — indistinguishable from
          // here, and presenting them as different states would be a guess.
          : { state: "unreachable", address: addressOf(c), name: null };
      }
      // Rebuilt from the watched list rather than merged into the previous
      // value, so a console that was just unbound cannot linger on the board.
      return next;
    });
  }, []);

  useEffect(() => {
    if (key === "") {
      setStatuses({});
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    // Chained timeouts rather than an interval: a probe that takes longer than
    // the interval must delay the next tick, not stack another one on top of
    // it. The wait is measured from when the tick STARTED, so the check happens
    // on its period — not the period plus however long the network took, which
    // is how a "ten-second" check quietly becomes a twelve-second one.
    const run = async () => {
      const startedAt = Date.now();
      await tick();
      if (stopped) return;

      // Quickly while a change is expected, at the usual rhythm otherwise.
      const period = Date.now() < fastUntil.current ? fastIntervalMs : intervalMs;
      const wait = Math.max(0, period - (Date.now() - startedAt));

      timer = setTimeout(() => void run(), wait);
      // …and the wait can be cut short: pressing Start should not mean waiting
      // out a period that began before the operator touched anything.
      wakeLoop.current = () => {
        clearTimeout(timer);
        void run();
      };
    };
    void run();

    return () => {
      stopped = true;
      wakeLoop.current = null;
      clearTimeout(timer);
    };
  }, [key, intervalMs, fastIntervalMs, tick]);

  /**
   * Ask now, and keep asking quickly for a short while.
   *
   * Called when something has just been asked to change, so the screen shows
   * what happened within a second or two rather than at the next ten-second
   * tick — which is the whole of what "it takes ages" was.
   */
  const refreshNow = useCallback(() => {
    fastUntil.current = Date.now() + WATCH_FAST_WINDOW_MS;
    wakeLoop.current?.();
  }, []);

  return { statuses, refreshNow, watching: key !== "" && Boolean(ps5Bridge()?.probe) };
};
