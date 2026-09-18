import type { StopSessionBody } from "@/api/sessions";
import {
  AddItemBody,
  apiAddSessionItem,
  apiAddSessionItems,
  apiResolveSessionItemsText,
  IResolvedItems,
  apiAddSessionJoystick,
  apiAddSessionTime,
  apiSessionExtensionOptions,
  apiTransferExtension,
  type IExtensionOptions,
  apiExtendSession,
  apiListEventsForSession,
  apiListSessionEvents,
  apiMakeSessionUnlimited,
  apiRemoveSessionJoystick,
  apiSetSessionFree,
  ISessionEvent,
  ListSessionEventsParams,
  apiListActiveSessions,
  apiListAllActiveSessions,
  apiListPackages,
  apiListPcs,
  apiListSessions,
  apiPreviewSession,
  apiRemoveSessionItem,
  apiSetSessionItemQty,
  apiStartSession,
  apiStopSessionWithBreakdown,
  IBillBreakdown,
  ListSessionsParams,
  StartSessionBody,
} from "@/api/sessions";
import { apiReorderPcs } from "@/api/pcs";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";

export interface StopResult {
  session: ISessionApi;
  breakdown: IBillBreakdown;
}

export class SessionRepository {
  async listActive(branchId: number): Promise<ISessionApi[]> {
    return orFallback(apiListActiveSessions(branchId).then((r) => r.data), []);
  }
  /**
   * Every session running right now, in every venue this account may see.
   *
   * `branch_id` is omitted deliberately: the endpoint applies the caller's
   * branch scope server-side, so leaving it out returns exactly their own
   * venues. Used by the console watcher and by the ending-soon warning, both
   * of which have to know about a seat whatever screen is open.
   */
  async listActiveEverywhere(): Promise<ISessionApi[]> {
    return orFallback(apiListAllActiveSessions().then((r) => r.data), []);
  }
  async list(params: ListSessionsParams): Promise<ISessionApi[]> {
    return orFallback(apiListSessions(params).then((r) => r.data), []);
  }
  async listPcs(branchId: number): Promise<IPcApi[]> {
    return orFallback(apiListPcs(branchId).then((r) => r.data), []);
  }
  async reorderPcs(branchId: number, order: number[]): Promise<void> {
    await apiReorderPcs(branchId, order);
  }
  async listPackages(branchId: number): Promise<ITimePackage[]> {
    return orFallback(apiListPackages(branchId).then((r) => r.data), []);
  }
  async start(body: StartSessionBody): Promise<ISessionApi> {
    return friendlyMutation(apiStartSession(body).then((r) => r.session));
  }
  async preview(id: number): Promise<IBillBreakdown> {
    return friendlyMutation(apiPreviewSession(id).then((r) => r.preview));
  }
  async stop(id: number, payment?: StopSessionBody): Promise<StopResult> {
    return friendlyMutation(apiStopSessionWithBreakdown(id, payment));
  }
  async extend(id: number, packageId: number): Promise<ISessionApi> {
    return friendlyMutation(apiExtendSession(id, { time_package_id: packageId }).then((r) => r.session));
  }
  async addItem(sessionId: number, body: AddItemBody): Promise<ISessionApi> {
    return friendlyMutation(apiAddSessionItem(sessionId, body).then((r) => r.session));
  }
  /** The dialog's basket, confirmed. One request, all or nothing. */
  async addItems(sessionId: number, items: AddItemBody[]): Promise<ISessionApi> {
    return friendlyMutation(apiAddSessionItems(sessionId, { items }).then((r) => r.session));
  }
  /**
   * What the typed lines would put on the bill. Reads only — the confirm still
   * goes through `addItems`, so there is one write path and one history.
   */
  async resolveItemsText(sessionId: number, text: string): Promise<IResolvedItems> {
    return friendlyMutation(apiResolveSessionItemsText(sessionId, text).then((r) => r.resolved));
  }
  async setItemQty(sessionId: number, itemId: number, qty: number): Promise<ISessionApi> {
    return friendlyMutation(apiSetSessionItemQty(sessionId, itemId, qty).then((r) => r.session));
  }
  async removeItem(sessionId: number, itemId: number): Promise<ISessionApi> {
    return friendlyMutation(apiRemoveSessionItem(sessionId, itemId).then((r) => r.session));
  }

  /* ── a live session's terms ─────────────────────────────────────────────
   *
   * Every one of these returns the WHOLE session, and callers replace their
   * row with it rather than patching a field. The backend owns the joystick
   * count, the end time and whether a bill is waived; a card that computed any
   * of them locally would be right until two cashiers touched the same seat.
   *
   * `friendlyMutation` matters more here than elsewhere: these refuse with a
   * sentence the operator has to read — "this place is booked in the app",
   * "no price is set for joystick #3" — and swallowing it would leave a
   * button that does nothing for no stated reason.
   */

  async addJoystick(sessionId: number, slot?: number): Promise<ISessionApi> {
    return friendlyMutation(apiAddSessionJoystick(sessionId, slot).then((r) => r.session));
  }

  async removeJoystick(sessionId: number, slot: number): Promise<ISessionApi> {
    return friendlyMutation(apiRemoveSessionJoystick(sessionId, slot).then((r) => r.session));
  }

  async addTime(sessionId: number, minutes: number): Promise<ISessionApi> {
    return friendlyMutation(apiAddSessionTime(sessionId, minutes).then((r) => r.session));
  }

  async makeUnlimited(sessionId: number, hourlyRate?: number): Promise<ISessionApi> {
    return friendlyMutation(apiMakeSessionUnlimited(sessionId, hourlyRate).then((r) => r.session));
  }

  /** Read-only advice: see `apiSessionExtensionOptions`. */
  async extensionOptions(sessionId: number, minutes: number): Promise<IExtensionOptions> {
    return apiSessionExtensionOptions(sessionId, minutes);
  }

  /** Move and extend, atomically. May still be refused — the list is stale. */
  async transferExtension(sessionId: number, placeId: number, minutes: number): Promise<ISessionApi> {
    return friendlyMutation(apiTransferExtension(sessionId, placeId, minutes).then((r) => r.session));
  }

  async setFree(sessionId: number, isFree: boolean): Promise<ISessionApi> {
    return friendlyMutation(apiSetSessionFree(sessionId, isFree).then((r) => r.session));
  }

  /* ── the audit trail ─────────────────────────────────────────────────── */

  async listEvents(params: ListSessionEventsParams): Promise<ISessionEvent[]> {
    return orFallback(apiListSessionEvents(params).then((r) => r.data), []);
  }

  async eventsForSession(sessionId: number): Promise<ISessionEvent[]> {
    return orFallback(apiListEventsForSession(sessionId).then((r) => r.data), []);
  }
}

export const sessionRepository = new SessionRepository();
