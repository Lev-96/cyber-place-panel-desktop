import {
  apiExtendSession,
  apiListActiveSessions,
  apiListPackages,
  apiListPcs,
  apiStartSession,
  apiStopSession,
  StartSessionBody,
} from "@/api/sessions";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";

export class SessionRepository {
  async listActive(branchId: number): Promise<ISessionApi[]> {
    return orFallback(apiListActiveSessions(branchId).then((r) => r.data), []);
  }
  async listPcs(branchId: number): Promise<IPcApi[]> {
    return orFallback(apiListPcs(branchId).then((r) => r.data), []);
  }
  async listPackages(branchId: number): Promise<ITimePackage[]> {
    return orFallback(apiListPackages(branchId).then((r) => r.data), []);
  }
  async start(body: StartSessionBody): Promise<ISessionApi> {
    return friendlyMutation(apiStartSession(body).then((r) => r.session));
  }
  async stop(id: number): Promise<ISessionApi> {
    return friendlyMutation(apiStopSession(id).then((r) => r.session));
  }
  async extend(id: number, packageId: number): Promise<ISessionApi> {
    return friendlyMutation(apiExtendSession(id, { time_package_id: packageId }).then((r) => r.session));
  }
}

export const sessionRepository = new SessionRepository();
