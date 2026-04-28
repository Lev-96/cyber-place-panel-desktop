import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchForm from "@/components/branches/BranchForm";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

const CompanyBranches = () => {
  const { user } = useAuth();
  const { companyId } = useParams();
  const id = Number(companyId);
  const { data: branches, loading, error, reload } = useAsync(
    () => branchRepository.list({ company_id: id }), [id],
  );
  const [creating, setCreating] = useState(false);
  const canCreate = can(user?.role, "branch.create");

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid company id.</div>;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`Branches of company #${id}`}>
      <div className="row-between">
        <Link to={`/companies/${id}`} className="muted">← Back to company</Link>
        {canCreate && <Button onClick={() => setCreating(true)}>+ New branch</Button>}
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(branches ?? []).map((b) => (
            <Link key={b.id} to={`/branches/${b.id}`} className="list-item">
              <div className="row" style={{ gap: 12, flex: 1 }}>
                <Avatar src={b.branch_logo_path} name={b.address} size={44} />
                <div style={{ flex: 1 }}>
                  <div className="name">{b.address}</div>
                  <div className="meta">{b.country}, {b.city} · places {b.places_count ?? 0} · services {b.service_count}</div>
                </div>
              </div>
              <span className="muted">Open →</span>
            </Link>
          ))}
          {!branches?.length && <div className="muted">No branches yet for this company.</div>}
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
