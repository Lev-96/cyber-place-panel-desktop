import type { IOwnerBranchApi, IOwnerDetailApi, IOwnerDetailCompanyApi } from "@/api/owners";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchStatusPill from "@/components/branches/BranchStatusPill";
import OwnerCompanyLine from "@/components/owners/OwnerCompanyLine";
import OwnerDeleteDialog from "@/components/owners/OwnerDeleteDialog";
import OwnerForm from "@/components/owners/OwnerForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { ownerRepository } from "@/repositories/OwnerRepository";
import { memo, ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

/**
 * One owner, for the admin (`/owners/:ownerId`, RoleGuard `owner.view`).
 *
 * Everything on it is the server's `GET /admin/owners/{id}` — the same read the
 * delete confirmation is built from — rendered as-is: who the owner is, each
 * of their companies (name → the existing company page, counts, state) and,
 * under each company, its branches with their status. Edit and Delete are THE
 * `OwnerForm` and THE `OwnerDeleteDialog` the list uses; after a delete there
 * is no owner left to show, so it goes back to the list.
 *
 * `companies[].branches` is newer than the rest of the payload. A backend that
 * omits it gets the counts alone — never "no branches" for a company that has
 * some.
 */
const OwnerDetails = () => {
  const { ownerId } = useParams();
  const { t } = useLang();
  const id = Number(ownerId);

  // A malformed id is not worth a request: say so and ask nothing.
  if (!Number.isInteger(id) || id <= 0) return <div className="error">{t("owner.invalidId")}</div>;
  return <OwnerPage id={id} />;
};

const OwnerPage = ({ id }: { id: number }) => {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user?.role, "owner.edit");
  const canDelete = can(user?.role, "owner.delete");
  const { data, loading, error, reload } = useAsync(() => ownerRepository.byId(id), [id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={data?.name ?? fmt(t("owner.fallbackTitle"), id)}>
      <div className="row-between screen-actions">
        <Link to="/owners" className="muted">{t("owner.back")}</Link>
        {data && (canEdit || canDelete) && (
          <div className="screen-actions__buttons">
            {canEdit && <Button variant="secondary" onClick={() => setEditing(true)}>{t("action.edit")}</Button>}
            {canDelete && (
              <Button variant="secondary" className="is-danger" onClick={() => setDeleting(true)}>
                {t("action.delete")}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <div className="error">{error.message}</div>}
      {loading && !data && <SkeletonCard lines={4} />}
      {data && <OwnerBody owner={data} />}

      {editing && data && (
        <OwnerForm
          owner={data}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void reload(); }}
        />
      )}
      {deleting && data && (
        <OwnerDeleteDialog
          owner={data}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate("/owners", { replace: true })}
        />
      )}
    </ScreenWithBg>
  );
};

const OwnerBody = ({ owner }: { owner: IOwnerDetailApi }) => {
  const { t } = useLang();
  const companies = owner.companies ?? [];
  return (
    <>
      <div className="gradient-card"><div className="gradient-card-inner">
        <Row k={t("label.name")} v={owner.name} />
        <Row k={t("label.email")} v={owner.email} />
        <Row k={t("owner.created")} v={formatDate(owner.created_at)} />
      </div></div>

      <h3 className="owner-section-title">{t("owner.companies")}</h3>
      {companies.length === 0 && <div className="muted">{t("owners.noCompany")}</div>}
      {companies.map((c) => <CompanyCard key={c.id} company={c} />)}
    </>
  );
};

/** A company: its line, then its branches — or nothing more when the backend sent no list. */
const CompanyCard = ({ company }: { company: IOwnerDetailCompanyApi }) => {
  const { t } = useLang();
  const { branches } = company;
  return (
    <section className="card owner-company">
      <OwnerCompanyLine company={company} className="owner-company__head" />
      {branches && branches.length === 0 && <div className="muted">{t("owner.noBranches")}</div>}
      {branches && branches.length > 0 && (
        <div className="list">
          {branches.map((b) => <BranchRow key={b.id} branch={b} />)}
        </div>
      )}
    </section>
  );
};

/** One branch, opening its hub. Memoised like every list row. */
const BranchRow = memo(({ branch: b }: { branch: IOwnerBranchApi }) => {
  const { t } = useLang();
  return (
    <Link to={`/branches/${b.id}`} className="list-item">
      <div className="owner-branch">
        <div className="name owner-branch__title">
          <span>{b.address || `№${b.id}`}</span>
          <BranchStatusPill status={b.status} />
          {b.is_blocked && <span className="pill blocked">{t("blocking.state.branch")}</span>}
        </div>
        <div className="meta">{b.city || "-"}</div>
      </div>
      <span className="muted">{t("common.open")}</span>
    </Link>
  );
});
BranchRow.displayName = "OwnerBranchRow";

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="kv-row"><span className="k">{k}</span><span className="v">{v}</span></div>
);

export default OwnerDetails;
