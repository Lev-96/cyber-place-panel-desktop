import type { IOwnerApi } from "@/api/owners";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import OwnerCompanyLine from "@/components/owners/OwnerCompanyLine";
import OwnerDeleteDialog from "@/components/owners/OwnerDeleteDialog";
import OwnerForm from "@/components/owners/OwnerForm";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLang } from "@/i18n/LanguageContext";
import { ownerRepository } from "@/repositories/OwnerRepository";
import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";

/** Typing pause before the list is asked again — one request per thought, not per key. */
const SEARCH_DEBOUNCE_MS = 400;

/**
 * The admin's Owners section: every company owner on the platform.
 *
 * Looks like the Managers screen (same list rows, same inline Edit / Delete),
 * plus what that screen never had: a server-side search (name, email or
 * company name) and pagination — this list is the whole partner base, not one
 * company's staff. The owner's name opens their own page (`OwnerDetails`:
 * companies with their branches); each company name still opens the company
 * page that already exists.
 */
const Owners = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const canEdit = can(user?.role, "owner.edit");
  const canDelete = can(user?.role, "owner.delete");

  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  // The page belongs to the query it was chosen for: a new search starts on
  // page 1 by construction, with no reset effect firing a second request.
  const [paging, setPaging] = useState({ query: "", page: 1 });
  const page = paging.query === query ? paging.page : 1;
  const setPage = (p: number) => setPaging({ query, page: p });

  const { data, loading, error, reload } = useAsync(() => ownerRepository.listPaged(page, query), [page, query]);
  const owners = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;

  // Deleting the only row of the last page leaves a page that no longer
  // exists; step back to the one that does instead of showing "no owners".
  useEffect(() => {
    if (!loading && page > lastPage) setPaging({ query, page: lastPage });
  }, [loading, page, lastPage, query]);

  const [editing, setEditing] = useState<IOwnerApi | null>(null);
  const [deleting, setDeleting] = useState<IOwnerApi | null>(null);

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={t("owners.title")}>
      <input
        className="input"
        placeholder={t("owners.search")}
        aria-label={t("owners.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={255}
      />
      {error && <div className="error">{error.message}</div>}
      {loading && !data ? (
        <ListSkeleton />
      ) : !error ? (
        <div className="list">
          {owners.map((o) => (
            <OwnerRow
              key={o.id}
              owner={o}
              onEdit={canEdit ? setEditing : undefined}
              onDelete={canDelete ? setDeleting : undefined}
            />
          ))}
          {!owners.length && !loading && (
            <div className="muted">{query ? t("owners.emptySearch") : t("owners.empty")}</div>
          )}
        </div>
      ) : null}
      {!error && <Pagination page={page} lastPage={lastPage} onChange={setPage} disabled={loading} />}

      {editing && (
        <OwnerForm
          owner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      {deleting && (
        <OwnerDeleteDialog
          owner={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); void reload(); }}
        />
      )}
    </ScreenWithBg>
  );
};

interface RowProps {
  owner: IOwnerApi;
  onEdit?: (o: IOwnerApi) => void;
  onDelete?: (o: IOwnerApi) => void;
}

/** One owner. Memoised: typing in the search box re-renders the screen, not every row. */
const OwnerRow = memo(({ owner, onEdit, onDelete }: RowProps) => {
  const { t } = useLang();
  const companies = owner.companies ?? [];
  return (
    <div className="list-item">
      <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        <div className="name">
          <Link to={`/owners/${owner.id}`} className="owner-link" title={t("owners.openOwner")}>{owner.name}</Link>
        </div>
        <div className="meta">{owner.email}</div>
        {companies.length === 0 && <div className="meta">{t("owners.noCompany")}</div>}
        {companies.map((c) => <OwnerCompanyLine key={c.id} company={c} />)}
      </div>
      {(onEdit || onDelete) && (
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          {onEdit && <Button variant="secondary" onClick={() => onEdit(owner)} style={btn}>{t("action.edit")}</Button>}
          {onDelete && (
            <Button variant="secondary" onClick={() => onDelete(owner)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>
              {t("action.delete")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
OwnerRow.displayName = "OwnerRow";

// Same compact inline buttons as the Managers rows.
const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default Owners;
