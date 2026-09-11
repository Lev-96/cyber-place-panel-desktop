import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchForm from "@/components/branches/BranchForm";
import BranchListRow from "@/components/branches/BranchListRow";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useAccessVersion } from "@/realtime/accessVersion";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";

/**
 * Global branches list, paginated (page navigation at the bottom).
 *
 * A branch always belongs to a company, so creating one needs a company id.
 * An owner has exactly one (`dashboard.company_id`), which is why THIS list
 * can offer "+ New branch" to them: it opens THE `BranchForm` (the same
 * component the company screens open) for that company. An admin has no
 * company of their own and creates branches from a company's page instead.
 */
const BranchesList = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  // Includes the access version so the "blocked" badge appears (and clears)
  // without the operator navigating away and back.
  const access = useAccessVersion();
  const { data, loading, error, reload } = useAsync(() => branchRepository.listPaged(page), [page, access]);
  const branches = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;

  // The create request needs a company; without one the form could only fail,
  // so the button is not drawn at all.
  const companyId = typeof user?.dashboard?.company_id === "number" ? user.dashboard.company_id : null;
  const canCreate = can(user?.role, "branch.create") && companyId !== null;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={t("branchesList.title")}>
      {canCreate && (
        <div className="row-between">
          <div />
          <Button onClick={() => setCreating(true)}>{t("branchesList.newBranch")}</Button>
        </div>
      )}
      {error && <div className="error">{error.message}</div>}
      {loading ? (
        <ListSkeleton />
      ) : !error ? (
        <div className="list">
          {branches.map((b) => (
            <BranchListRow
              key={b.id}
              to={`/branches/${b.id}`}
              leading={<Avatar src={b.branch_logo_path} name={b.address} size={44} />}
              title={`${b.company?.name ?? t("hub.branchFallback")} · ${b.address}`}
              meta={`${b.country}, ${b.city} · ${t("branchesList.placesShort")} ${b.places_count ?? 0}`}
              status={b.status}
              // An owner walking this list must see which venue is out of
              // service BEFORE opening it, or the read-only branch page reads
              // as something that just broke.
              blockedLabel={b.is_blocked ? (b.blocked_at ? t("blocking.state.branch") : t("blocking.state.byCompany")) : null}
            />
          ))}
          {!branches.length && <div className="muted">{t("common.empty.branches")}</div>}
        </div>
      ) : null}
      {!error && <Pagination page={page} lastPage={lastPage} onChange={setPage} disabled={loading} />}
      {/* Same handling as the company's own branch list: close, then re-read
          the page on screen. The POST already dropped every cached branch
          listing, and the repository's "created" toast confirms the save even
          when the new branch lands on a later page (the list is in id order). */}
      {creating && companyId !== null && (
        <BranchForm
          companyId={companyId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void reload(); }}
        />
      )}
    </ScreenWithBg>
  );
};

export default BranchesList;
