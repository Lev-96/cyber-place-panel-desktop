import { Role } from "@/types/api";
import { request } from "./client";

/** A staff account the signed-in user may hand the panel over to. */
export interface IAccountSwitchTarget {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** The branch the account runs — null for an owner. */
  branch: { id: number; address: string; city: string } | null;
}

/**
 * Accounts the CURRENT user may switch into: an owner gets the managers of his
 * branches, a manager gets his owner plus the colleagues of the same company.
 * The scope is resolved server-side from the caller alone — there is no
 * parameter, by design. Carries no credentials: switching is still a normal
 * sign-in with the target's own password.
 */
export const apiListAccountSwitchTargets = () =>
  request<{ data: IAccountSwitchTarget[] }>("/account-switch/targets");
