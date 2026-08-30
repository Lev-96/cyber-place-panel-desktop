import { apiReportUnexpectedWake } from "@/api/ps5";
import { usePs5WakeDecided } from "@/realtime/usePs5Realtime";
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

interface Options {
  branchId: number;
  /** Console devices of this branch, as the board has them. */
  devices: IPcApi[];
  /** Device ids that currently have a running session. */
  sessionDeviceIds: Set<number>;
  /** Whether this panel may act at all — a viewer with no rights just watches. */
  enabled?: boolean;
}

interface Intent { at: number }

export const useConsoleControl = ({ branchId, devices, sessionDeviceIds, enabled = true }: Options) => {
  /** Bound consoles only: a device with no console is not this feature's business. */
  const bound = useMemo(
    () => devices.filter((d) => d.console_host_id),
    [devices],
  );

  const watched: WatchedConsole[] = useMemo(
    () => bound.map((d) => ({ hostId: d.console_host_id as string, address: d.console_address ?? null })),
    [bound],
  );

  const { statuses } = useConsoleWatch(watched, {
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

  const controllerRef = useRef<Ps5Controller | null>(null);
  const [views, setViews] = useState<Record<string, ReturnType<Ps5Controller["view"]>>>({});

  if (controllerRef.current === null) {
    const ports: ControllerPorts = {
      wake: async (hostId, address) => {
        const api = ps5Bridge();
        if (!api?.wake) return { sent: false, code: "UNSUPPORTED_BY_TRANSPORT" };
        return api.wake(hostId, address);
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

  /** The owner answered. Feed it to the machine for the console it names. */
  usePs5WakeDecided(branchId, useCallback((event) => {
    const device = devices.find((d) => d.id === event.device_id);
    if (!device?.console_host_id) return;

    setDecisions((d) => ({
      ...d,
      [device.console_host_id as string]: { eventId: event.event_uuid, approved: event.approved },
    }));
    setNudge((n) => n + 1);
  }, [devices]));

  /** Call when the operator presses Start: the console may wake from now on. */
  const sessionStarting = useCallback((deviceId: number) => {
    setStarting((s) => ({ ...s, [deviceId]: { at: Date.now() } }));
    setNudge((n) => n + 1);
  }, []);

  /** Call when a session has actually stopped on the backend. */
  const sessionStopped = useCallback((deviceId: number) => {
    setStopping((s) => ({ ...s, [deviceId]: { at: Date.now() } }));
    setStarting((s) => {
      const next = { ...s };
      delete next[deviceId];
      return next;
    });
    setNudge((n) => n + 1);
  }, []);

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
        decision: decisions[hostId] ?? null,
      };
    });

    void controller.tick(inputs).then(() => {
      setViews(Object.fromEntries(inputs.map((i) => [i.hostId, controller.view(i.hostId)])));
    });

    // Consoles that are no longer bound must not linger in the controller.
    const live = new Set(bound.map((d) => d.console_host_id as string));
    controller.forget(Object.keys(statuses).filter((h) => !live.has(h)));
  }, [statuses, bound, sessionDeviceIds, starting, stopping, decisions, enabled, nudge]);

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

  return { views, statuses, sessionStarting, sessionStopped };
};
