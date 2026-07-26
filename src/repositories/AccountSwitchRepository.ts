import { apiListAccountSwitchTargets, IAccountSwitchTarget } from "@/api/accountSwitch";
import { orFallback } from "@/api/fallback";

/**
 * Read side of the account picker. Follows the repository convention of this
 * app: the API shape stays in `api/`, screens depend on this thin, mockable
 * seam, and a failed request degrades to "no accounts offered" instead of
 * breaking the sidebar the operator is working in.
 */
export class AccountSwitchRepository {
  async targets(): Promise<IAccountSwitchTarget[]> {
    return orFallback(apiListAccountSwitchTargets().then((r) => r.data), []);
  }
}

export const accountSwitchRepository = new AccountSwitchRepository();
