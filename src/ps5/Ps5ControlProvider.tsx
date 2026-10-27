import { apiListPcsEverywhere } from "@/api/pcs";
import { apiListAllActiveSessions } from "@/api/sessions";
import { useAuth } from "@/auth/AuthContext";
import { useConsoleControl } from "@/ps5/useConsoleControl";
import { usePs5WakeDecided } from "@/realtime/usePs5Realtime";
import { useSessionChanged } from "@/realtime/useSessionChanged";
import { ps5DiscoveryAvailable } from "@/ps5/usePs5Discovery";
import { IPcApi } from "@/types/sessions";
import { platformGroup } from "@/utils/platform";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  /** The keys on this machine changed (paired, typed, forgotten): ask the vault again. */
  credentialsChanged: () => void;
}

const noop = () => {};

const Ps5ControlContext = createContext<Ps5Control>({
  views: {},
  statuses: {},
  sessionStarting: noop,
  sessionStopped: noop,
  credentialsChanged: noop,
});

/** How often the watcher re-reads which consoles exist and what is running. */
const LISTS_REFRESH_MS = 30_000;

/**
 * The session changes that add or remove a running session on a device — the
 * only ones a console has to follow. Pads, time, pauses and the like change
 * nothing about whether it should be awake.
 */
const SESSION_SET_CHANGES = new Set(["started", "stopped", "moved"]);

export const Ps5ControlProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  // Without the desktop bridge there is nothing to watch with — a browser
  // during development, or an older build.
  const available = ps5DiscoveryAvailable();

  const [devices, setDevices] = useState<IPcApi[]>([]);
  const [sessionDeviceIds, setSessionDeviceIds] = useState<Set<number>>(new Set());

  /**
   * Bumped by every read and every local change to the running set. A read is
   * applied only if nothing newer happened after it was asked: a Stop's read or
   * a poll that lands after the next Start would otherwise put back the "no
   * session" it saw, and the console would be sent to rest under the player.
   */
  const generation = useRef(0);
  /**
   * The running set this panel last acted on, or null before the first read.
   * A read that differs from it is a session started or ended somewhere else —
   * another counter, a player's QR, a booking, the server's own clock — and is
   * acted on exactly as a Start or a Stop pressed here (2026-10-27). Without
   * it every panel decided from its own presses and a list up to 30 s old, so
   * a panel that had not seen a session yet put to sleep the console another
   * had just woken, and the first woke it again.
   */
  const known = useRef<Set<number> | null>(null);
  /** The intents, reachable from the read without rebuilding it. */
  const intents = useRef<{ starting: (id: number) => void; stopping: (id: number) => void }>({ starting: () => {}, stopping: () => {} });

  const reload = useCallback(async () => {
    const asked = ++generation.current;
    try {
      const [pcs, sessions] = await Promise.all([
        apiListPcsEverywhere("ps").then((r) => r.data),
        apiListAllActiveSessions().then((r) => r.data),
      ]);
      if (asked !== generation.current) return;

      const consoles = pcs.filter((d) => d.console_host_id && d.place && platformGroup(d.place.platform) === "ps");
      const running = new Set(sessions.map((s) => s.pc_id));
      const before = known.current;
      known.current = running;
      setDevices(consoles);
      setSessionDeviceIds(running);

      // The first read is the state of things, not a change: nobody pressed
      // anything, and every running console is simply left to the monitor.
      if (before === null) return;
      for (const device of consoles) {
        const now = running.has(device.id);
        if (now && !before.has(device.id)) intents.current.starting(device.id);
        if (!now && before.has(device.id)) intents.current.stopping(device.id);
      }
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
    devices,
    sessionDeviceIds,
    enabled: signedIn && available,
  });

  /**
   * Every venue with a bound console, so the owner's answer reaches the panel
   * that has to act on it.
   *
   * One listener per branch: the answer travels on the branch feed, and a hook
   * cannot subscribe to a list. Watching only the first venue is what would
   * leave a second one never hearing "no".
   */
  const branchIds = useMemo(
    () => [...new Set(devices.map((d) => d.branch_id))].sort((a, b) => a - b),
    [devices],
  );

  intents.current = { starting: control.sessionStarting, stopping: control.sessionStopped };

  // The lists are re-read as soon as a session starts or stops, so the watcher
  // is not deciding from a list that is up to thirty seconds old. The local
  // change goes into `known` too, so the read that follows does not see this
  // panel's own press as a change made elsewhere and act on it twice.
  const value = useMemo<Ps5Control>(() => ({
    views: control.views,
    statuses: control.statuses,
    sessionStarting: (deviceId: number) => {
      generation.current++;
      if (known.current) known.current = new Set(known.current).add(deviceId);
      setSessionDeviceIds((ids) => new Set(ids).add(deviceId));
      control.sessionStarting(deviceId);
      void reload();
    },
    sessionStopped: (deviceId: number) => {
      generation.current++;
      if (known.current) {
        const next = new Set(known.current);
        next.delete(deviceId);
        known.current = next;
      }
      setSessionDeviceIds((ids) => {
        const next = new Set(ids);
        next.delete(deviceId);
        return next;
      });
      control.sessionStopped(deviceId);
      void reload();
    },
    credentialsChanged: control.credentialsChanged,
  }), [control, reload]);

  return (
    <Ps5ControlContext.Provider value={value}>
      {branchIds.map((id) => (
        <WakeDecisionListener key={id} branchId={id} onDecided={control.wakeDecided} />
      ))}
      {branchIds.map((id) => (
        <SessionSetListener key={`s${id}`} branchId={id} onChanged={reload} />
      ))}
      {children}
    </Ps5ControlContext.Provider>
  );
};

/**
 * One branch's answers.
 *
 * A component rather than a loop of hooks, because a subscription per branch is
 * exactly what React components are for — and the number of branches changes as
 * the device list loads.
 */
const WakeDecisionListener = ({
  branchId,
  onDecided,
}: {
  branchId: number;
  onDecided: (deviceId: number, eventUuid: string, approved: boolean) => void;
}) => {
  usePs5WakeDecided(branchId, useCallback((event) => {
    onDecided(event.device_id, event.event_uuid, event.approved);
  }, [onDecided]));

  return null;
};

/**
 * One branch's session starts and ends, as they happen (2026-10-27).
 *
 * Its own listener on the same private channel the board listens on — Echo
 * keeps one subscription per channel and `stopListening` removes only this
 * handler, so the board and this never take each other's events away. Only
 * a change to WHICH devices have a session triggers a read; the 30 s read
 * stays as the fallback for a missed frame.
 */
const SessionSetListener = ({ branchId, onChanged }: { branchId: number; onChanged: () => Promise<void> }) => {
  useSessionChanged(branchId, useCallback((event) => {
    if (SESSION_SET_CHANGES.has(event.kind)) void onChanged();
  }, [onChanged]));

  return null;
};

/** What a screen needs from the watcher: the states, and the two intents. */
export const usePs5Control = (): Ps5Control => useContext(Ps5ControlContext);
