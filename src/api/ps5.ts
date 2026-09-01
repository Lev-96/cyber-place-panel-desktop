import { IPcApi } from "@/types/sessions";
import { request } from "./client";

/**
 * The console endpoints that are not about binding.
 *
 * Two conversations live here. One is with the venue's own rules — a
 * maintenance window an owner opens so the panel stops putting a console back
 * to sleep while somebody is updating games on it. The other is the question
 * that gets asked when a console is on and nothing authorised it: the panel in
 * the room reports it, the owner answers, and the answer comes back over the
 * socket to whichever panel has to act on it.
 */

export interface Ps5WakeEventApi {
  id: number;
  event_uuid: string;
  device_id: number;
  branch_id: number;
  /** The venue by its city and street — a branch has no name column. */
  branch_name: string | null;
  /** Whether this owner has more than one venue. Answered by the server. */
  multi_branch: boolean;
  decision: "pending" | "approved" | "rejected" | "expired";
  detected_at: string;
  place_label: string | null;
}

/** Suspend the "no session means asleep" rule. Owner-level on the backend. */
export const apiStartMaintenance = (deviceId: number, minutes: number) =>
  request<{ pc: IPcApi }>(`/pcs/${deviceId}/maintenance`, { method: "POST", body: { minutes } });

export const apiStopMaintenance = (deviceId: number) =>
  request<{ pc: IPcApi }>(`/pcs/${deviceId}/maintenance`, { method: "DELETE" });

/**
 * "This console is awake and I have no session for it."
 *
 * The id is minted by the panel that saw it, so its own retries and the owner's
 * answer all name the same event. Idempotent on the backend for exactly that
 * reason.
 */
export const apiReportUnexpectedWake = (deviceId: number, eventUuid: string) =>
  // `wake_event` is null when the server decides the console being on is
  // already explained — a session running on it, or one that ended moments ago
  // and has not finished going to sleep. Nothing was recorded and nobody was
  // asked; the console is still put to rest by the panel that reported it.
  request<{ wake_event: Ps5WakeEventApi | null; reason?: string }>(`/pcs/${deviceId}/wake-events`, {
    method: "POST",
    body: { event_uuid: eventUuid },
  });

/** The owner's answer. Refused for anyone else, and for an event already decided. */
export const apiDecideWakeEvent = (id: number, approved: boolean) =>
  request<{ wake_event: Ps5WakeEventApi }>(`/ps5-wake-events/${id}/decision`, {
    method: "POST",
    body: { approved },
  });

/** Nobody answered in time — recorded so the history can tell that from a refusal. */
export const apiExpireWakeEvent = (id: number) =>
  request<{ wake_event: Ps5WakeEventApi }>(`/ps5-wake-events/${id}/expire`, { method: "POST" });

/**
 * Questions still waiting for an answer.
 *
 * What an owner's panel asks for when it opens: a broadcast is only heard by
 * whoever was listening at the time, and a console that woke while nobody had a
 * tab open is still awake now.
 */
export const apiPendingWakeEvents = (branchId?: number) =>
  request<{ data: Ps5WakeEventApi[] }>("/ps5-wake-events", {
    params: branchId ? { branch_id: branchId } : {},
  });
