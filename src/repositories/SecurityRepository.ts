import {
  apiCreateBlockedCountry, apiCreateBlockedIp, apiDeleteBlockedCountry, apiDeleteBlockedIp,
  apiListBlockedCountries, apiListBlockedIps,
  CreateBlockedCountryBody, CreateBlockedIpBody, IBlockedCountryListApi, IBlockedIpListApi,
} from "@/api/security";
import { apiListIpActivity, IIpActivityListApi, IpActivityQuery } from "@/api/ipActivity";
import { withToast } from "@/ui/notify";

/**
 * The admin's Security section. Shaped after `OwnerRepository`, for the same
 * two reasons:
 *
 *  - No `orFallback` on reads: an empty list is what that turns a failure
 *    into, and "no blocked IPs" when the read failed is a false statement on
 *    the one screen where it matters most.
 *  - No `friendlyMutation` on writes: a 404 here means the rule is already
 *    gone (another admin got there first), and the server's
 *    own sentence says so.
 *
 * Every write raises a toast; each still re-throws, so a form can show the
 * server's 422 under its field.
 */
export class SecurityRepository {
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

  /** One page of the IP activity, searched and filtered by the server. */
  async ipActivity(query: IpActivityQuery): Promise<IIpActivityListApi> {
    return apiListIpActivity(query);
  }
}

export const securityRepository = new SecurityRepository();
