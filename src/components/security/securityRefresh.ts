import { createContext, useContext, useEffect, useRef } from "react";

/**
 * One list's re-read: resolves `true` when its fresh answer is on screen,
 * `false` when it failed or was overtaken (`useAsync`'s `reload`). Never rejects.
 */
export type SecurityReload = () => Promise<boolean>;

export interface SecurityRefreshRegistry {
  /** Adds a list's re-read; the returned function removes it. */
  register: (reload: SecurityReload) => () => void;
}

/**
 * The Security screen's Refresh button (2026-10-09) re-reads exactly the lists
 * on screen. Each tab or section registers its reload while it is mounted, so a
 * tab nobody opened is never fetched, and one that was closed stops being
 * asked. Outside the screen (a tab rendered on its own) registration is a no-op.
 */
export const SecurityRefreshContext = createContext<SecurityRefreshRegistry>({
  register: () => () => {},
});

/**
 * Registers `reload` for as long as the caller is mounted and `enabled`.
 * The LATEST `reload` is the one called — `useAsync` makes a new one when the
 * query changes, so the activity tab re-reads its current search, filters and
 * page, not the ones it mounted with.
 */
export const useSecurityRefresh = (reload: SecurityReload, enabled = true): void => {
  const { register } = useContext(SecurityRefreshContext);
  const latest = useRef(reload);

  useEffect(() => {
    latest.current = reload;
  }, [reload]);

  useEffect(() => {
    if (!enabled) return undefined;
    return register(() => latest.current());
  }, [register, enabled]);
};

/**
 * Runs every registered re-read at once and says whether the round succeeded:
 * every list that is STILL registered when its answer came back must have
 * answered. A list unmounted mid-round (the tab was switched) is not a failure
 * — nobody is looking at it any more. A reload that throws anyway counts as a
 * failure rather than breaking the round.
 */
export const refreshAll = async (registered: ReadonlySet<SecurityReload>): Promise<boolean> => {
  const round = [...registered];
  const results = await Promise.all(round.map((reload) => reload().catch(() => false)));
  return results.every((ok, i) => ok || !registered.has(round[i]));
};
