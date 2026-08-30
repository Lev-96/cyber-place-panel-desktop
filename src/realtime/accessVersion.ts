/**
 * "What you are allowed to see just changed" — a counter every screen that
 * renders an access-dependent state can watch.
 *
 * A block arrives on the account's private channel and is applied at once
 * ({@link AccessGuard}). Signing the person out is the easy half; the hard half
 * is the screen that stays open and keeps describing the OLD state. Unblocking
 * is where that shows: the branch reopens on the server, and the branch page in
 * front of the owner goes on saying "blocked — read only" with every section
 * greyed out, because nothing on it had any reason to re-ask.
 *
 * Rather than have each screen subscribe to Echo, the guard bumps this counter
 * and screens include it in their fetch dependencies. One subscription, one
 * source of truth for "re-read what you are showing", and no component needs to
 * know what a block is.
 *
 * A tiny framework-agnostic pub/sub, mirroring {@link ../auth/sessionExpiry}
 * and {@link ../ui/notify} — the guard is not a provider and must not become
 * one just for this.
 */

import { useEffect, useState } from "react";

type Listener = (version: number) => void;

const listeners = new Set<Listener>();
let version = 0;

export const accessVersion = {
  /** Current value — the number of access changes seen this session. */
  current: (): number => version,

  /** An access change landed: everything derived from it is now stale. */
  bump: (): void => {
    version += 1;
    for (const l of listeners) {
      // A throwing listener (mid-unmount, for instance) must not stop the
      // others from hearing about a block.
      try { l(version); } catch { /* ignore */ }
    }
  },

  /** Subscribe; returns an unsubscribe fn. */
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

/**
 * React binding: put the returned value in a fetch's dependency list and the
 * fetch re-runs whenever an administrator changes what this account may reach.
 */
export const useAccessVersion = (): number => {
  const [v, setV] = useState(accessVersion.current);
  useEffect(() => accessVersion.subscribe(setV), []);
  return v;
};
