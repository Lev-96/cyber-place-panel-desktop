import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchForm from "@/components/branches/BranchForm";
import CompanyBillingCard from "@/components/companies/CompanyBillingCard";
import CompanyForm from "@/components/companies/CompanyForm";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

const CompanyDetails = () => {
  const { user } = useAuth();
  const { companyId } = useParams();
  const id = Number(companyId);
  const { data: company, loading, error, reload } = useAsync(() => companyRepository.byId(id), [id]);
  const [editing, setEditing] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid company id.</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;
  if (!company) return null;

  const c = company.raw;
  const canEditCompany = can(user?.role, "company.edit");
  const canAddBranch = can(user?.role, "branch.create");

  return (
    <ScreenWithBg bg="./bg/company.jpg" title={c.name}>
      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <Avatar src={c.company_logo_path} name={c.name} size={96} shape="square" />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{c.name}</div>
          <div className="muted">{c.email}</div>
        </div>
      </div>
      <div className="gradient-card"><div className="gradient-card-inner">
        <Row k="Email"        v={c.email} />
        <Row k="Phone"        v={c.phone || "—"} />
        <Row k="Country"      v={c.company_country || "—"} />
        <Row k="City"         v={c.company_city || "—"} />
        <Row k="TIN"          v={c.tin || "—"} />
        <Row k="Website"      v={c.website || "—"} />
        <Row k="Description"  v={c.description || "—"} />
        <Row k="Owner"        v={c.user?.name ?? "—"} />
        <Row k="Status"       v={<span className={`pill ${c.status}`}>{c.status}</span>} />
        <Row k="Branches"     v={String(c.branches_count ?? 0)} />
        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {canEditCompany && <Button variant="secondary" onClick={() => setEditing(true)}>Edit company</Button>}
          {canAddBranch && <Button onClick={() => setAddingBranch(true)}>+ Add branch</Button>}
          <Link to={`/companies/${id}/branches`} className="btn secondary">View branches ({c.branches_count ?? 0})</Link>
          <Link to={`/companies/${id}/revenue`} className="btn secondary">Revenue & commission</Link>
        </div>
      </div></div>

      <CompanyBillingCard companyId={c.id} companyName={c.name} />

      {editing && (
        <CompanyForm initial={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void reload(); }} />
      )}
      {addingBranch && (
        <BranchForm
          companyId={id}
          onClose={() => setAddingBranch(false)}
          onSaved={() => { setAddingBranch(false); void reload(); }}
        />
      )}
    </ScreenWithBg>
  );
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="kv-row"><span className="k">{k}</span><span className="v">{v}</span></div>
);

export default CompanyDetails;
