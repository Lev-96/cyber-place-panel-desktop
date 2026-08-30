import {
  AddItemBody,
  apiAddSessionItem,
  apiAddSessionItems,
  apiExtendSession,
  apiListActiveSessions,
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
  async stop(id: number): Promise<StopResult> {
    return friendlyMutation(apiStopSessionWithBreakdown(id));
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
  async setItemQty(sessionId: number, itemId: number, qty: number): Promise<ISessionApi> {
    return friendlyMutation(apiSetSessionItemQty(sessionId, itemId, qty).then((r) => r.session));
  }
  async removeItem(sessionId: number, itemId: number): Promise<ISessionApi> {
    return friendlyMutation(apiRemoveSessionItem(sessionId, itemId).then((r) => r.session));
  }
}

export const sessionRepository = new SessionRepository();
