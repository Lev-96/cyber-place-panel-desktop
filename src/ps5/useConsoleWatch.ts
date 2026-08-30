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

/** Ten seconds — how often a bound console is asked how it is doing. */
export const WATCH_INTERVAL_MS = 10_000;

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
  const { intervalMs = WATCH_INTERVAL_MS } = options;
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
    // every ten seconds — not every ten seconds plus however long the network
    // took, which is how a "ten-second" check quietly becomes a twelve-second
    // one.
    const run = async () => {
      const startedAt = Date.now();
      await tick();
      if (!stopped) timer = setTimeout(() => void run(), Math.max(0, intervalMs - (Date.now() - startedAt)));
    };
    void run();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [key, intervalMs, tick]);

  return { statuses, watching: key !== "" && Boolean(ps5Bridge()?.probe) };
};
