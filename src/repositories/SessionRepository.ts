import {
  apiExtendSession,
  apiListActiveSessions,
  apiListPackages,
  apiListPcs,
  apiStartSession,
  apiStopSession,
  StartSessionBody,
} from "@/api/sessions";
import { ApiError } from "@/api/client";
import { logger } from "@/infrastructure/Logger";
import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { mockSessionsApi } from "./MockSessionsApi";

/**
 * Routes calls to the real Laravel endpoints; falls back to the local
 * mock when those endpoints aren't deployed yet (404 / 501).
 *
 * Once the backend ships, no UI change is required — the mock simply
 * stops being used because the real API stops 404-ing.
 */
const isFallback = (e: unknown) => {
  const err = e as ApiError;
  return err && (err.status === 404 || err.status === 501 || err.status === 0 || !err.status);
};

export class SessionRepository {
  async listActive(branchId: number): Promise<ISessionApi[]> {
    try { return (await apiListActiveSessions(branchId)).data; }
    catch (e) { if (!isFallback(e)) throw e; logger.warn("sessions API not available, using mock"); return mockSessionsApi.listActive(branchId); }
  }
  async listPcs(branchId: number): Promise<IPcApi[]> {
    try { return (await apiListPcs(branchId)).data; }
    catch (e) { if (!isFallback(e)) throw e; return mockSessionsApi.listPcs(branchId); }
  }
  async listPackages(branchId: number): Promise<ITimePackage[]> {
    try { return (await apiListPackages(branchId)).data; }
    catch (e) { if (!isFallback(e)) throw e; return mockSessionsApi.listPackages(); }
  }
  async start(body: StartSessionBody): Promise<ISessionApi> {
    try { return (await apiStartSession(body)).session; }
    catch (e) { if (!isFallback(e)) throw e; return mockSessionsApi.start(body); }
  }
  async stop(id: number): Promise<ISessionApi> {
    try { return (await apiStopSession(id)).session; }
    catch (e) { if (!isFallback(e)) throw e; return mockSessionsApi.stop(id); }
  }
  async extend(id: number, packageId: number): Promise<ISessionApi> {
    try { return (await apiExtendSession(id, { package_id: packageId })).session; }
    catch (e) { if (!isFallback(e)) throw e; return mockSessionsApi.extend(id, packageId); }
  }
}

export const sessionRepository = new SessionRepository();
