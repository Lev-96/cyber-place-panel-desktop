import { AuthUser } from "@/types/api";

/**
 * Which Reverb channel carries booking events for THIS user, and whether it
 * has to be authorised.
 *
 * Three call sites used to answer this question separately, and two of them
 * answered it wrong: `Home.tsx` and `useReservedPlaceIds` both subscribed to
 * `bookings.global` for every role, then filtered by `branch_id` on the
 * client. Filtering client-side is not scoping — an owner's and a manager's
 * machine still received every booking on the platform, with the guest's name
 * and the booking code in the payload.
 *
 *   admin          → bookings.global   private, every booking everywhere
 *   company_owner  → company.{id}      private, every branch of their company
 *   manager        → branch.{id}       public  (see below)
 *
 * `branch.{id}` stays public for now because the mobile app listens to it on a
 * guest token, and a guest cannot authorise a private channel on the sanctum
 * guard. Making it private is a separate change that also has to slim the
 * payload, since anyone can register a guest.
 *
 * Orphan staff (owner with no `dashboard.company_id`, manager with no
 * `branch_id`) get `null` and no subscription at all. That is deliberate and
 * predates this file: falling back to the global channel is what produced the
 * cross-tenant toasts a manager once reported.
 */
export interface BookingScopeChannel {
  name: string;
  /** true → subscribe with `echo.private()`; the wire name gains `private-`. */
  isPrivate: boolean;
}

export const resolveBookingScopeChannel = (
  user: AuthUser | null | undefined,
): BookingScopeChannel | null => {
  if (!user) return null;

  if (user.role === "admin") {
    return { name: "bookings.global", isPrivate: true };
  }

  if (user.role === "company_owner") {
    const companyId = user.dashboard?.company_id;
    if (!companyId) return null;
    return { name: `company.${companyId}`, isPrivate: true };
  }

  if (user.role === "manager") {
    const branchId = user.dashboard?.branch_id;
    if (!branchId) return null;
    return { name: `branch.${branchId}`, isPrivate: false };
  }

  return null;
};
