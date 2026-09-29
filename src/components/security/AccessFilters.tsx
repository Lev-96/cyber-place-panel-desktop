import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { companyRepository } from "@/repositories/CompanyRepository";
import {
  CLIENT_ACCESS_STATUS, CLIENT_ACCESS_STATUSES, ClientAccessStatus, STAFF_CLIENT, STAFF_CLIENTS, STAFF_ROLES, StaffClient, StaffRole,
} from "@/types/security";
import { CLIENT_LABEL_KEY, ROLE_LABEL_KEY, STATUS_LOOK } from "./securityLabels";

/** What the access list is narrowed by — everything but the search text. */
export interface AccessFilterState {
  role: StaffRole | null;
  companyId: number | null;
  branchId: number | null;
  /** Client and status travel together: the contract reads `status` for the `client` named. */
  clientStatus: { client: StaffClient; status: ClientAccessStatus } | null;
}

export const NO_ACCESS_FILTERS: AccessFilterState = { role: null, companyId: null, branchId: null, clientStatus: null };

const encodeClientStatus = (v: AccessFilterState["clientStatus"]): string => (v ? `${v.client}:${v.status}` : "");

const decodeClientStatus = (raw: string): AccessFilterState["clientStatus"] => {
  const [client, status] = raw.split(":");
  const c = STAFF_CLIENTS.find((x) => x === client);
  const s = CLIENT_ACCESS_STATUSES.find((x) => x === status);
  return c && s ? { client: c, status: s } : null;
};

/** `pending` is Telegram's alone: granted, and the link not yet confirmed in the bot. */
const statusesOf = (client: StaffClient): readonly ClientAccessStatus[] =>
  client === STAFF_CLIENT.Telegram
    ? CLIENT_ACCESS_STATUSES
    : CLIENT_ACCESS_STATUSES.filter((s) => s !== CLIENT_ACCESS_STATUS.Pending);

interface Props {
  value: AccessFilterState;
  onChange: (next: AccessFilterState) => void;
}

/**
 * The access list's filters. Companies and branches come from the lists the
 * admin already reads elsewhere (`/company`, `/branches?company_id=`) — no
 * endpoint of its own. Branches are offered once a company is picked: the
 * whole platform's branches in one select is a list nobody can scan, and the
 * branch listing is capped per request anyway.
 */
const AccessFilters = ({ value, onChange }: Props) => {
  const { t } = useLang();
  const companies = useAsync(() => companyRepository.list(), []);
  const branches = useAsync(
    () => (value.companyId === null ? Promise.resolve([]) : branchRepository.list({ company_id: value.companyId })),
    [value.companyId],
  );

  return (
    <div className="sec-filters">
      <label className="sec-field">
        <span className="label">{t("security.filter.role")}</span>
        <select
          className="input"
          value={value.role ?? ""}
          onChange={(e) => onChange({ ...value, role: STAFF_ROLES.find((r) => r === e.target.value) ?? null })}
        >
          <option value="">{t("security.filter.anyRole")}</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL_KEY[r])}</option>)}
        </select>
      </label>

      <label className="sec-field">
        <span className="label">{t("label.company")}</span>
        <select
          className="input"
          value={value.companyId ?? ""}
          disabled={companies.loading && !companies.data}
          onChange={(e) => onChange({
            ...value,
            companyId: e.target.value ? Number(e.target.value) : null,
            // A branch belongs to the company it was picked under.
            branchId: null,
          })}
        >
          <option value="">{t("security.filter.anyCompany")}</option>
          {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {value.companyId !== null && (
        <label className="sec-field">
          <span className="label">{t("security.filter.branch")}</span>
          <select
            className="input"
            value={value.branchId ?? ""}
            disabled={branches.loading}
            onChange={(e) => onChange({ ...value, branchId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{t("security.filter.anyBranch")}</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.address || `№${b.id}`}</option>
            ))}
          </select>
        </label>
      )}

      <label className="sec-field">
        <span className="label">{t("security.filter.clientStatus")}</span>
        <select
          className="input"
          value={encodeClientStatus(value.clientStatus)}
          onChange={(e) => onChange({ ...value, clientStatus: decodeClientStatus(e.target.value) })}
        >
          <option value="">{t("security.filter.anyClientStatus")}</option>
          {STAFF_CLIENTS.map((client) => (
            <optgroup key={client} label={t(CLIENT_LABEL_KEY[client])}>
              {statusesOf(client).map((status) => (
                <option key={status} value={`${client}:${status}`}>
                  {`${t(CLIENT_LABEL_KEY[client])}: ${t(STATUS_LOOK[status].key)}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
};

export default AccessFilters;
