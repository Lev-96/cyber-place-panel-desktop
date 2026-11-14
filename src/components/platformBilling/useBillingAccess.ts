import { apiCompanyBilling } from "@/api/billing";
import { apiGetBranchById } from "@/api/branches";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { billingAccessOf, type BillingAccess } from "@/types/platformBilling";

/**
 * Is new work here limited by an unpaid Cyber Place Platform invoice?
 * (2026-11-09) The server decides (`billing_access`); this only reads it:
 *
 *  - a branch screen asks the branch (`GET /branches/{id}`, staff covering it);
 *  - the company-wide tournaments list asks the manager's branch, or the
 *    owner's company billing (`GET /company/{id}/billing`).
 *
 * Administrators are never limited. Anything that fails, or an older backend
 * that sends no `billing_access`, reads as `active`: the screen stays as it was.
 */
export const useBillingAccess = (branchId?: number | null): BillingAccess => {
  const { user } = useAuth();
  const [access, setAccess] = useState<BillingAccess>("active");
  const role = user?.role;
  const ownBranch = user?.dashboard?.branch_id ?? null;
  const company = user?.dashboard?.company_id ?? null;

  useEffect(() => {
    let alive = true;
    setAccess("active");
    if (!role || role === "admin") return;
    const branch = branchId ?? (role === "manager" ? ownBranch : null);
    const read: Promise<unknown> | null = branch
      ? apiGetBranchById(branch).then((r) => r.branch?.billing_access)
      : role === "company_owner" && company
        ? apiCompanyBilling(company).then((b) => (b as { billing_access?: unknown }).billing_access)
        : null;
    read?.then((raw) => { if (alive) setAccess(billingAccessOf(raw)); }).catch(() => {});
    return () => { alive = false; };
  }, [role, branchId, ownBranch, company]);

  return access;
};
