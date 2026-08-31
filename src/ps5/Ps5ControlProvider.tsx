import { apiListPcsEverywhere } from "@/api/pcs";
import { apiListAllActiveSessions } from "@/api/sessions";
import { useAuth } from "@/auth/AuthContext";
import { useConsoleControl } from "@/ps5/useConsoleControl";
import { ps5DiscoveryAvailable } from "@/ps5/usePs5Discovery";
import { IPcApi } from "@/types/sessions";
import { platformGroup } from "@/utils/platform";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Watches this venue's consoles from wherever the panel happens to be.
 *
 * It used to watch only from the sessions board, which is where the watching
 * was first needed — a console is woken and rested from there. But detection is
 * the other half of the job, and a console switched on by hand does not wait
 * for somebody to open the right screen. With the watcher living on one page,
 * an owner sitting on Places, or on the dashboard, or anywhere else, was never
 * told: the question was never raised at all, because nothing was looking.
 *
 * So it lives here, mounted once for the whole application. The lists it needs
 * come from endpoints whose branch is optional and whose scope is the server's,
 * so this is exactly the venues the signed-in account may see and nothing more.
 *
 * ## One watcher, not two
 * The sessions board reads this context rather than starting its own. Two
 * watchers would each mint their own id for the same wake and the owner would
 * be asked the same question twice.
 *
 * ## It does nothing at all when there is nothing to do
 * No consoles bound, no desktop bridge, or a role with no venues: no timers, no
 * requests, no traffic.
 */

interface Ps5Control {
  views: ReturnType<typeof useConsoleControl>["views"];
  statuses: ReturnType<typeof useConsoleControl>["statuses"];
  sessionStarting: (deviceId: number) => void;
  sessionStopped: (deviceId: number) => void;
}

const noop = () => {};

const Ps5ControlContext = createContext<Ps5Control>({
  views: {},
  statuses: {},
  sessionStarting: noop,
  sessionStopped: noop,
});

/** How often the watcher re-reads which consoles exist and what is running. */
const LISTS_REFRESH_MS = 30_000;

export const Ps5ControlProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  // Without the desktop bridge there is nothing to watch with — a browser
  // during development, or an older build.
  const available = ps5DiscoveryAvailable();

  const [devices, setDevices] = useState<IPcApi[]>([]);
  const [sessionDeviceIds, setSessionDeviceIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    try {
      const [pcs, sessions] = await Promise.all([
        apiListPcsEverywhere("ps").then((r) => r.data),
        apiListAllActiveSessions().then((r) => r.data),
      ]);

      setDevices(pcs.filter((d) => d.console_host_id && d.place && platformGroup(d.place.platform) === "ps"));
      setSessionDeviceIds(new Set(sessions.map((s) => s.pc_id)));
    } catch {
      // Offline, or a backend without these listings. The watcher simply has
      // nothing to watch until the next attempt; nothing else is affected.
    }
  }, []);

  useEffect(() => {
    if (!signedIn || !available) return;

    let alive = true;
    const pull = () => { if (alive) void reload(); };

    pull();
    const timer = setInterval(pull, LISTS_REFRESH_MS);

    return () => { alive = false; clearInterval(timer); };
  }, [signedIn, available, reload]);

  const control = useConsoleControl({
    // Every venue at once: the branch only ever narrowed which consoles were
    // watched, and a console in the other one still has to be noticed.
    branchId: devices[0]?.branch_id ?? 0,
    devices,
    sessionDeviceIds,
    enabled: signedIn && available,
  });

  // The lists are re-read as soon as a session starts or stops, so the watcher
  // is not deciding from a list that is up to thirty seconds old.
  const value = useMemo<Ps5Control>(() => ({
    views: control.views,
    statuses: control.statuses,
    sessionStarting: (deviceId: number) => {
      setSessionDeviceIds((ids) => new Set(ids).add(deviceId));
      control.sessionStarting(deviceId);
      void reload();
    },
    sessionStopped: (deviceId: number) => {
      setSessionDeviceIds((ids) => {
        const next = new Set(ids);
        next.delete(deviceId);
        return next;
      });
      control.sessionStopped(deviceId);
      void reload();
    },
  }), [control, reload]);

  return <Ps5ControlContext.Provider value={value}>{children}</Ps5ControlContext.Provider>;
};

/** What a screen needs from the watcher: the states, and the two intents. */
export const usePs5Control = (): Ps5Control => useContext(Ps5ControlContext);
