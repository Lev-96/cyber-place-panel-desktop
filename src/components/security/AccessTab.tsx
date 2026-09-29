import type { IStaffAccessApi, ListClientAccessParams } from "@/api/security";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { securityRepository } from "@/repositories/SecurityRepository";
import { ClientAccessAction, STAFF_CLIENTS, StaffClient } from "@/types/security";
import { useCallback, useEffect, useState } from "react";
import AccessFilters, { AccessFilterState, NO_ACCESS_FILTERS } from "./AccessFilters";
import AccessRow from "./AccessRow";
import { CLIENT_LABEL_KEY } from "./securityLabels";
import StaffSessionsModal from "./StaffSessionsModal";

/** Typing pause before the list is asked again — one request per thought, not per key. */
export const SEARCH_DEBOUNCE_MS = 400;

const paramsOf = (query: string, f: AccessFilterState, page: number): ListClientAccessParams => ({
  search: query || undefined,
  role: f.role ?? undefined,
  company_id: f.companyId ?? undefined,
  branch_id: f.branchId ?? undefined,
  client: f.clientStatus?.client,
  status: f.clientStatus?.status,
  page,
});

/**
 * Web & Telegram access of every owner and manager: who may sign in to the
 * owner web app and to the Telegram bot, granted and revoked from here. The
 * status on each badge is the server's; after every write the page is read
 * again, because a revoke also ends sessions and changes the count.
 */
const AccessTab = () => {
  const { t } = useLang();
  const confirm = useConfirm();
  // `begin` / `end` are stable; the hook's object is not, and the row callback must be.
  const { begin, end, isBusy } = useKeyedBusy();

  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState<AccessFilterState>(NO_ACCESS_FILTERS);

  // The page belongs to the query it was chosen for: new filters or a new
  // search start on page 1 by construction, with no reset effect firing a
  // second request (the Owners screen's idiom).
  const key = JSON.stringify([query, filters]);
  const [paging, setPaging] = useState({ key: "", page: 1 });
  const page = paging.key === key ? paging.page : 1;

  const { data, loading, error, reload } = useAsync(
    () => securityRepository.listAccess(paramsOf(query, filters, page)),
    [key, page],
  );
  const rows = data?.data ?? [];
  const lastPage = data?.meta.last_page ?? 1;

  useEffect(() => {
    if (!loading && page > lastPage) setPaging({ key, page: lastPage });
  }, [loading, page, lastPage, key]);

  const [sessionsOf, setSessionsOf] = useState<IStaffAccessApi | null>(null);

  const onAction = useCallback(async (row: IStaffAccessApi, client: StaffClient, action: ClientAccessAction) => {
    const clientName = t(CLIENT_LABEL_KEY[client]);
    if (action === "revoke") {
      const ok = await confirm(fmt(t("security.access.confirmRevoke"), clientName, row.name), {
        confirmLabel: t("security.access.revoke"),
        destructive: true,
      });
      if (!ok) return;
    }
    if (!begin(row.id)) return;
    try {
      if (action === "grant") await securityRepository.grantAccess(row.id, client);
      else await securityRepository.revokeAccess(row.id, client);
    } catch {
      // The toast already said it failed; the re-read shows what is true.
    } finally {
      end(row.id);
    }
    void reload();
  }, [begin, end, confirm, reload, t]);

  return (
    <div className="col sec-stack">
      <input
        className="input"
        type="search"
        placeholder={t("security.access.search")}
        aria-label={t("security.access.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={255}
      />
      <AccessFilters value={filters} onChange={setFilters} />

      {error && <div className="error">{error.message}</div>}
      {loading && !data ? (
        <ListSkeleton rows={5} />
      ) : !error ? (
        rows.length ? (
          <div className="sec-table-wrap">
            <table className="sec-table">
              <thead>
                <tr>
                  <th scope="col">{t("security.col.user")}</th>
                  <th scope="col">{t("security.col.role")}</th>
                  <th scope="col">{t("security.col.workplace")}</th>
                  {STAFF_CLIENTS.map((c) => <th key={c} scope="col">{t(CLIENT_LABEL_KEY[c])}</th>)}
                  <th scope="col">{t("security.col.sessions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <AccessRow
                    key={row.id}
                    row={row}
                    busy={isBusy(row.id)}
                    onAction={onAction}
                    onSessions={setSessionsOf}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">{t("security.access.empty")}</div>
        )
      ) : null}
      {!error && (
        <Pagination page={page} lastPage={lastPage} onChange={(p) => setPaging({ key, page: p })} disabled={loading} />
      )}

      {sessionsOf && (
        <StaffSessionsModal
          user={sessionsOf}
          onClose={() => setSessionsOf(null)}
          onChanged={() => void reload()}
        />
      )}
    </div>
  );
};

export default AccessTab;
