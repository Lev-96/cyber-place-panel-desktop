import type { ISecurityAuditEntryApi } from "@/api/security";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { securityRepository } from "@/repositories/SecurityRepository";
import {
  isSecurityAuditAction, isStaffClient, SECURITY_AUDIT_ACTIONS, SecurityAuditAction,
} from "@/types/security";
import { memo, useState } from "react";
import { countryLabel } from "./countryNames";
import { AUDIT_ACTION_LABEL_KEY, CLIENT_LABEL_KEY } from "./securityLabels";

/**
 * Who did what in this section, newest first as the server orders it. The
 * action is worded by the panel from its code; a code a newer backend added
 * is shown as the code rather than dropped.
 */
const AuditTab = () => {
  const { t } = useLang();
  const [action, setAction] = useState<SecurityAuditAction | null>(null);
  // The page belongs to the filter it was chosen for (Owners idiom).
  const [paging, setPaging] = useState<{ action: SecurityAuditAction | null; page: number }>({ action: null, page: 1 });
  const page = paging.action === action ? paging.page : 1;

  const { data, loading, error } = useAsync(
    () => securityRepository.audit({ action: action ?? undefined, page }),
    [action, page],
  );
  const rows = data?.data ?? [];
  const lastPage = data?.meta.last_page ?? 1;

  return (
    <div className="col sec-stack">
      <div className="sec-filters">
        <label className="sec-field">
          <span className="label">{t("security.audit.action")}</span>
          <select
            className="input"
            value={action ?? ""}
            onChange={(e) => setAction(isSecurityAuditAction(e.target.value) ? e.target.value : null)}
          >
            <option value="">{t("security.audit.anyAction")}</option>
            {SECURITY_AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{t(AUDIT_ACTION_LABEL_KEY[a])}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="error">{error.message}</div>}
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : !error && rows.length === 0 ? (
        <div className="muted">{t("security.audit.empty")}</div>
      ) : !error ? (
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th scope="col">{t("security.col.when")}</th>
                <th scope="col">{t("security.audit.action")}</th>
                <th scope="col">{t("security.col.actor")}</th>
                <th scope="col">{t("security.col.subject")}</th>
                <th scope="col">{t("security.col.ip")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <AuditRow key={r.id} entry={r} />)}
            </tbody>
          </table>
        </div>
      ) : null}
      {!error && (
        <Pagination page={page} lastPage={lastPage} onChange={(p) => setPaging({ action, page: p })} disabled={loading} />
      )}
    </div>
  );
};

/** The words for an action code; the code itself for one this build does not know. */
export const auditActionLabel = (action: string, t: (key: string) => string): string =>
  isSecurityAuditAction(action) ? t(AUDIT_ACTION_LABEL_KEY[action]) : action;

const AuditRow = memo(({ entry }: { entry: ISecurityAuditEntryApi }) => {
  const { t, lang } = useLang();
  const subject = entry.subject;
  // A country subject is named in the reading language, like everywhere else.
  const subjectText = !subject
    ? "-"
    : subject.type === "country" && /^[A-Za-z]{2}$/.test(subject.label) ? countryLabel(subject.label, lang) : subject.label;
  const client = entry.meta?.client;
  return (
    <tr>
      <td data-label={t("security.col.when")}>{formatDateTime(entry.created_at)}</td>
      <td data-label={t("security.audit.action")}>
        <div className="sec-user">
          <span>{auditActionLabel(entry.action, t)}</span>
          {isStaffClient(client) && <span className="meta">{t(CLIENT_LABEL_KEY[client])}</span>}
        </div>
      </td>
      <td data-label={t("security.col.actor")}>{entry.actor?.name ?? t("security.audit.system")}</td>
      <td data-label={t("security.col.subject")} className="sec-wrap">{subjectText}</td>
      <td data-label={t("security.col.ip")} className="sec-num">{entry.ip ?? "-"}</td>
    </tr>
  );
});
AuditRow.displayName = "AuditRow";

export default AuditTab;
