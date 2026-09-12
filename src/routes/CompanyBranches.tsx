import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchForm from "@/components/branches/BranchForm";
import BranchListRow from "@/components/branches/BranchListRow";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

const CompanyBranches = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const { companyId } = useParams();
  const id = Number(companyId);
  const { data: branches, loading, error, reload } = useAsync(
    () => branchRepository.list({ company_id: id }), [id],
  );
  const [creating, setCreating] = useState(false);
  const canCreate = can(user?.role, "branch.create");

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidCompanyId")}</div>;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={fmt(t("companyBranches.title"), id)}>
      <div className="row-between">
        <Link to={`/companies/${id}`} className="muted">{t("companyBranches.back")}</Link>
        {canCreate && <Button onClick={() => setCreating(true)}>{t("companyBranches.newBranch")}</Button>}
      </div>
      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(branches ?? []).map((b) => (
            <BranchListRow
              key={b.id}
              to={`/branches/${b.id}`}
              leading={<Avatar src={b.branch_logo_path} name={b.address} size={44} />}
              title={b.address}
              meta={`${b.country}, ${b.city} · ${t("label.places")} ${b.places_count ?? 0}`}
              status={b.status}
              // Tells a branch closed on its own apart from one closed with its
              // company: only the first can be reopened from the branch screen.
              blockedLabel={b.is_blocked ? (b.blocked_at ? t("blocking.state.branch") : t("blocking.state.byCompany")) : null}
            />
          ))}
          {!branches?.length && <div className="muted">{t("companyBranches.empty")}</div>}
        </div>
      )}
      {creating && (
        <BranchForm
          companyId={id}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void reload(); }}
        />
      )}
    </ScreenWithBg>
  );
};

export default CompanyBranches;
