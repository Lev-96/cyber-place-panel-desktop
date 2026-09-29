import {
  apiCreateBlockedCountry, apiCreateBlockedIp, apiDeleteBlockedCountry, apiDeleteBlockedIp,
  apiGrantClientAccess, apiListBlockedCountries, apiListBlockedIps, apiListClientAccess,
  apiListSecurityAudit, apiListStaffSessions, apiRevokeAllStaffSessions, apiRevokeClientAccess,
  apiRevokeStaffSession,
  CreateBlockedCountryBody, CreateBlockedIpBody, IBlockedCountryListApi, IBlockedIpListApi,
  ISecurityAuditEntryApi, ISecurityPageApi, IStaffAccessApi, IStaffSessionApi,
  ListAuditParams, ListClientAccessParams,
} from "@/api/security";
import type { StaffClient } from "@/types/security";
import { withToast } from "@/ui/notify";

/**
 * The admin's Security section. Shaped after `OwnerRepository`, for the same
 * two reasons:
 *
 *  - No `orFallback` on reads: an empty list is what that turns a failure
 *    into, and "no blocked IPs" when the read failed is a false statement on
 *    the one screen where it matters most.
 *  - No `friendlyMutation` on writes: a 404 here means the user, session or
 *    rule is already gone (another admin got there first), and the server's
 *    own sentence says so.
 *
 * Every write raises a toast; each still re-throws, so a form can show the
 * server's 422 under its field.
 */
export class SecurityRepository {
  /** One page (25, server-fixed) of owners and managers with their client access. */
  async listAccess(params: ListClientAccessParams): Promise<ISecurityPageApi<IStaffAccessApi>> {
    return apiListClientAccess(params);
  }

  async grantAccess(userId: number, client: StaffClient): Promise<void> {
    await withToast("clientAccess", "granted", () => apiGrantClientAccess(userId, client));
  }

  /** Also ends that client's sessions at once, server-side. */
  async revokeAccess(userId: number, client: StaffClient): Promise<void> {
    await withToast("clientAccess", "revoked", () => apiRevokeClientAccess(userId, client));
  }

  async sessions(userId: number): Promise<IStaffSessionApi[]> {
    return (await apiListStaffSessions(userId)).data;
  }

  async revokeSession(userId: number, tokenId: number): Promise<void> {
    await withToast("staffSession", "revoked", () => apiRevokeStaffSession(userId, tokenId));
  }

  /** Every session, the desktop panel's included. Returns how many ended. */
  async revokeAllSessions(userId: number): Promise<number> {
    return withToast("staffSession", "revokedAll", async () => (await apiRevokeAllStaffSessions(userId)).revoked);
  }

  async blockedIps(): Promise<IBlockedIpListApi> {
    return apiListBlockedIps();
  }

  async blockIp(body: CreateBlockedIpBody): Promise<void> {
    await withToast("blockedIp", "created", () => apiCreateBlockedIp(body));
  }

  async unblockIp(id: number): Promise<void> {
    await withToast("blockedIp", "deleted", () => apiDeleteBlockedIp(id));
  }

  async blockedCountries(): Promise<IBlockedCountryListApi> {
    return apiListBlockedCountries();
  }

  async blockCountry(body: CreateBlockedCountryBody): Promise<void> {
    await withToast("blockedCountry", "created", () => apiCreateBlockedCountry(body));
  }

  async unblockCountry(id: number): Promise<void> {
    await withToast("blockedCountry", "deleted", () => apiDeleteBlockedCountry(id));
  }

  async audit(params: ListAuditParams): Promise<ISecurityPageApi<ISecurityAuditEntryApi>> {
    return apiListSecurityAudit(params);
  }
}

export const securityRepository = new SecurityRepository();
