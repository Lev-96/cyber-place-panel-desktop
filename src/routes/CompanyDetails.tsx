import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BlockToggle from "@/components/blocking/BlockToggle";
import BranchForm from "@/components/branches/BranchForm";
import CompanyBillingCard from "@/components/companies/CompanyBillingCard";
import CompanyForm from "@/components/companies/CompanyForm";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

const CompanyDetails = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const { companyId } = useParams();
  const id = Number(companyId);
  const { data: company, loading, error, reload } = useAsync(() => companyRepository.byId(id), [id]);
  const [editing, setEditing] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("company.invalidId")}</div>;
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
        <Row k={t("company.email")}       v={c.email} />
        <Row k={t("company.phone")}       v={c.phone || "—"} />
        <Row k={t("company.country")}     v={c.company_country || "—"} />
        <Row k={t("company.city")}        v={c.company_city || "—"} />
        <Row k={t("company.tin")}         v={c.tin || "—"} />
        <Row k={t("company.website")}     v={c.website || "—"} />
        <Row k={t("company.description")} v={c.description || "—"} />
        <Row k={t("company.owner")}       v={c.user?.name ?? "—"} />
        <Row k={t("company.status")}      v={<span className={`pill ${c.status}`}>{t(`company.status.${c.status}`) || c.status}</span>} />
        {/* Shown only when it applies: an active company has nothing to say
            here, and a permanent "not blocked" row would be noise on every
            other company in the network. */}
        {c.is_blocked && (
          <Row
            k={t("blocking.state")}
            v={<span className="pill blocked">{t("blocking.state.company")}</span>}
          />
        )}
        <Row k={t("company.branches")}    v={String(c.branches_count ?? 0)} />
        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {canEditCompany && <Button variant="secondary" onClick={() => setEditing(true)}>{t("company.edit")}</Button>}
          {canAddBranch && <Button onClick={() => setAddingBranch(true)}>{t("company.addBranch")}</Button>}
          {/* Sits with the other company-level actions, and refreshes the
              screen from the server afterwards rather than trusting the local
              copy — the block also changes the branches underneath it. */}
          <BlockToggle
            kind="company"
            id={c.id}
            name={c.name}
            blockedAt={c.blocked_at}
            isBlocked={c.is_blocked}
            onChanged={() => void reload()}
          />
          <Link to={`/companies/${id}/branches`} className="btn secondary">{t("company.viewBranches")} ({c.branches_count ?? 0})</Link>
          {can(user?.role, "revenue.view") && (
            <Link to={`/companies/${id}/revenue`} className="btn secondary">{t("revenue.title")}</Link>
          )}
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
