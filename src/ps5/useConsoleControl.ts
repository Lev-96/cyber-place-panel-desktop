import { apiReportUnexpectedWake } from "@/api/ps5";
import { notify } from "@/ui/notify";
import { tActive } from "@/i18n/translations";
import { ps5Bridge } from "@/ps5/usePs5Discovery";
import { useConsoleWatch, type WatchedConsole } from "@/ps5/useConsoleWatch";
import { Ps5Controller, type ConsoleInput, type ControllerPorts } from "@/ps5/Ps5Controller";
import { IPcApi } from "@/types/sessions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Ties the venue's facts to the consoles in the room.
 *
 * The state machine and the controller know nothing about React, sessions or
 * the backend; this is where those meet. It reads what the board already knows
 * — which devices are bound, which have a session on them, whether an owner has
 * opened a maintenance window — adds what only this machine knows (what the
 * consoles just said, and what the operator has just pressed) and hands the
 * lot to the controller.
 *
 * ## Where "starting" and "stopping" live
 * In here, and nowhere else. `gaming_sessions.status` is `active | stopped |
 * expired`, and those three feed billing and revenue; a session that is
 * "starting" is not a billing fact, it is the seconds between the operator
 * pressing Start and the console answering. Holding it locally is what stops
 * the monitor from seeing "awake, no session yet" and helpfully switching the
 * console off under the player — without touching a schema that the mobile app,
 * the agent and the revenue reports all read.
 */

/** How long a local "starting" intent stands before it is assumed to have failed. */
const INTENT_TTL_MS = 60_000;

/**
 * How long a press counts as urgent.
 *
 * Enough to carry the command and its confirmation past the rate limits that
 * exist for the monitor, and no longer — those limits are what keep a console
 * from being asked something forty times a minute.
 */
const URGENT_WINDOW_MS = 15_000;

interface Options {
  /** Console devices of this branch, as the board has them. */
  devices: IPcApi[];
  /** Device ids that currently have a running session. */
  sessionDeviceIds: Set<number>;
  /** Whether this panel may act at all — a viewer with no rights just watches. */
  enabled?: boolean;
}

interface Intent { at: number }

export const useConsoleControl = ({ devices, sessionDeviceIds, enabled = true }: Options) => {
  /** Bound consoles only: a device with no console is not this feature's business. */
  const bound = useMemo(
    () => devices.filter((d) => d.console_host_id),
    [devices],
  );

  const watched: WatchedConsole[] = useMemo(
    () => bound.map((d) => ({ hostId: d.console_host_id as string, address: d.console_address ?? null })),
    [bound],
  );

  /**
   * Which console belongs to which device, as a value the callbacks can read
   * without being rebuilt every time the list changes.
   */
  const boundRef = useRef<Array<{ deviceId: number; hostId: string }>>([]);
  boundRef.current = bound.map((d) => ({ deviceId: d.id, hostId: d.console_host_id as string }));

  const { statuses, refreshNow } = useConsoleWatch(watched, {
    onAddressChanged: useCallback((hostId: string, address: string) => {
      const device = bound.find((d) => d.console_host_id === hostId);
      if (device) void import("@/repositories/PcRepository").then(({ pcRepository }) =>
        pcRepository.rememberConsoleAddress(device.id, hostId, address));
    }, [bound]),
  });

  /** Start pressed / stop confirmed, by device id, with the moment it happened. */
  const [starting, setStarting] = useState<Record<number, Intent>>({});
  const [stopping, setStopping] = useState<Record<number, Intent>>({});
  /** The owner's answers, by console. Cleared once the machine has consumed one. */
  const [decisions, setDecisions] = useState<Record<string, { eventId: string; approved: boolean }>>({});
  /** Forces a control pass outside the ten-second rhythm, right after a press. */
  const [nudge, setNudge] = useState(0);
  /**
   * Consoles an operator has just acted on, and until when that counts.
   *
   * A press is not a monitor tick: it must not wait out a cooldown that started
   * before anybody touched anything. The window is short — long enough to cover
   * the command and the confirmation, not long enough to disable the rate
   * limits that keep a console from being shouted at all shift.
   */
  const urgentUntil = useRef<Record<number, number>>({});
  /**
   * What the transport underneath can actually do.
   *
   * Asked once rather than assumed, so the machine never issues a command that
   * will be refused — which is what left a console sitting in "going to rest…"
   * while the request was reissued every ten seconds. Defaults to "cannot",
   * because claiming a capability we have not confirmed is the failure that
   * shows up as a console still running after a shift ends.
   */
  const [canRest, setCanRest] = useState(false);

  useEffect(() => {
    const api = ps5Bridge();
    if (!api?.capabilities) return;

    let alive = true;
    void api.capabilities()
      .then((caps) => { if (alive) setCanRest(Boolean(caps?.rest)); })
      .catch(() => { /* an older preload: leave it at "cannot" */ });

    return () => { alive = false; };
  }, []);

  /** When each console last had a failure announced, so a retry is not a nag. */
  const toldAt = useRef<Record<string, number>>({});
  const controllerRef = useRef<Ps5Controller | null>(null);
  const [views, setViews] = useState<Record<string, ReturnType<Ps5Controller["view"]>>>({});

  if (controllerRef.current === null) {
    const ports: ControllerPorts = {
      wake: async (hostId, address) => {
        const api = ps5Bridge();
        if (!api?.wake) return { sent: false, code: "UNSUPPORTED_BY_TRANSPORT" };

        const result = await api.wake(hostId, address);
        // A wake that could not even be attempted has to reach the person who
        // pressed Start. Without this it was a chip on a tile they were not
        // looking at, and the console simply "did nothing" — which is what a
        // missing key looked like from the floor.
        if (!result.sent && result.reason) {
          const key = result.reason === "no-credential" ? "ps5.error.NO_CREDENTIAL"
            : result.reason === "bad-credential" ? "ps5.error.BAD_CREDENTIAL"
              : "ps5.error.TRANSPORT_ERROR";
          // Once per console per minute: the monitor retries, and the operator
          // does not need the same sentence every time it does.
          const last = toldAt.current[hostId] ?? 0;
          if (Date.now() - last > 60_000) {
            toldAt.current[hostId] = Date.now();
            notify.message("error", tActive(key));
          }
        }

        return result;
      },
      rest: async (hostId, address) => {
        const api = ps5Bridge();
        if (!api?.rest) {
          // An older desktop build, or a browser. Not a silent no-op: the
          // caller records it and the screen says the console is still awake.
          return { sent: false, code: "UNSUPPORTED_BY_TRANSPORT" };
        }
        return api.rest(hostId, address);
      },
      reportUnexpectedWake: async ({ deviceId, eventId }) => {
        await apiReportUnexpectedWake(deviceId, eventId);
      },
      log: (event, fields) => {
        // Structured and greppable, and carrying nothing secret: this side
        // never sees a wake key — it names a console and the main process looks
        // up what it may send.
        console.info(`[ps5] ${event}`, fields);
      },
      now: () => Date.now(),
      newId: () => crypto.randomUUID(),
    };

    controllerRef.current = new Ps5Controller(ports);
  }

  /**
   * The owner answered.
   *
   * Fed in from outside rather than subscribed to here: the watcher covers every
   * venue this account can see, and a hook cannot subscribe to a list of
   * branches. The provider mounts one listener per branch and calls this.
   */
  const wakeDecided = useCallback((deviceId: number, eventUuid: string, approved: boolean) => {
    const device = boundRef.current.find((d) => d.deviceId === deviceId);
    if (!device) return;

    setDecisions((d) => ({ ...d, [device.hostId]: { eventId: eventUuid, approved } }));
    setNudge((n) => n + 1);
    // The console is about to change state one way or the other, and the
    // operator should not wait ten seconds to see which.
    refreshNow();
  }, [refreshNow]);

  /** Call when the operator presses Start: the console may wake from now on. */
  const sessionStarting = useCallback((deviceId: number) => {
    urgentUntil.current[deviceId] = Date.now() + URGENT_WINDOW_MS;
    setStarting((s) => ({ ...s, [deviceId]: { at: Date.now() } }));
    setNudge((n) => n + 1);
    // Ask the console now, and keep asking quickly: the operator is watching
    // the tile, and the next scheduled look could be ten seconds away.
    refreshNow();
  }, [refreshNow]);

  /** Call when a session has actually stopped on the backend. */
  const sessionStopped = useCallback((deviceId: number) => {
    urgentUntil.current[deviceId] = Date.now() + URGENT_WINDOW_MS;
    setStopping((s) => ({ ...s, [deviceId]: { at: Date.now() } }));
    setStarting((s) => {
      const next = { ...s };
      delete next[deviceId];
      return next;
    });
    setNudge((n) => n + 1);
    refreshNow();
  }, [refreshNow]);

  // One control pass per observation, plus one immediately after a press. The
  // observations arrive every ten seconds from the monitor, which is what makes
  // this the rhythm of the whole feature.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !enabled) return;

    const now = Date.now();
    const inputs: ConsoleInput[] = bound.map((device) => {
      const hostId = device.console_host_id as string;
      const status = statuses[hostId];
      const startIntent = starting[device.id];
      const stopIntent = stopping[device.id];
      const maintenanceUntil = device.maintenance_until ? Date.parse(device.maintenance_until) : 0;

      return {
        deviceId: device.id,
        hostId,
        // The live address beats the stored one: the console may have moved
        // since the row was written.
        address: status?.address ?? device.console_address ?? null,
        actual: status?.state ?? "unknown",
        hasSession: sessionDeviceIds.has(device.id),
        // An intent that nothing confirmed within a minute is a failed start,
        // not a licence to stay awake all evening.
        starting: Boolean(startIntent) && now - (startIntent?.at ?? 0) < INTENT_TTL_MS,
        stopping: Boolean(stopIntent) && now - (stopIntent?.at ?? 0) < INTENT_TTL_MS,
        maintenance: maintenanceUntil > now,
        canRest,
        urgent: (urgentUntil.current[device.id] ?? 0) > now,
        decision: decisions[hostId] ?? null,
      };
    });

    void controller.tick(inputs).then(() => {
      setViews(Object.fromEntries(inputs.map((i) => [i.hostId, controller.view(i.hostId)])));
    });

    // Consoles that are no longer bound must not linger in the controller.
    const live = new Set(bound.map((d) => d.console_host_id as string));
    controller.forget(Object.keys(statuses).filter((h) => !live.has(h)));
  }, [statuses, bound, sessionDeviceIds, starting, stopping, decisions, enabled, nudge, canRest]);

  // A session that has actually started clears the local intent — from here the
  // backend is the source of truth again.
  useEffect(() => {
    setStarting((s) => {
      const next = { ...s };
      let changed = false;
      for (const id of Object.keys(next)) {
        if (sessionDeviceIds.has(Number(id))) { delete next[Number(id)]; changed = true; }
      }
      return changed ? next : s;
    });
  }, [sessionDeviceIds]);

  return { views, statuses, sessionStarting, sessionStopped, wakeDecided };
};
