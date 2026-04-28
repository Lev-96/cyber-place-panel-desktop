import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import CompanyForm from "@/components/companies/CompanyForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";
import { Link } from "react-router-dom";

const CompaniesList = () => {
  const { user } = useAuth();
  const { data: companies, loading, error, reload } = useAsync(() => companyRepository.list(), []);
  const [creating, setCreating] = useState(false);
  const canCreate = can(user?.role, "company.create");

  return (
    <ScreenWithBg bg="./bg/company.jpg" title="Companies">
      <div className="row-between">
        <Link to="/revenue" className="muted">Revenue & commission →</Link>
        {canCreate && <Button onClick={() => setCreating(true)}>+ New company</Button>}
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(companies ?? []).map((c) => (
            <Link key={c.id} to={`/companies/${c.id}`} className="list-item">
              <div>
                <div className="name">{c.name}</div>
                <div className="meta">
                  {c.raw.email} · branches {c.raw.branches_count ?? 0} ·{" "}
                  <span className={`pill ${c.raw.status}`}>{c.raw.status}</span>
                </div>
              </div>
              <span className="muted">Open →</span>
            </Link>
          ))}
          {!companies?.length && <div className="muted">No companies.</div>}
        </div>
      )}
      {creating && <CompanyForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
    </ScreenWithBg>
  );
};

export default CompaniesList;
