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
 *   manager        → branch.{id}       private, the branch they cash for
 *
 * All three are private now. The public `branch.{id}` still exists and still
 * carries a `booking.changed` — but a different, person-free event
 * (`BookingChangedPublic`), which is what the mobile app reads on its guest
 * token. Staff need the guest's name and the booking code for the toast, and
 * those only ever travel privately.
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
    return { name: `branch.${branchId}`, isPrivate: true };
  }

  return null;
};
