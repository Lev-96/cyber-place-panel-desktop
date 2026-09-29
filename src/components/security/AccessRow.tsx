import type { IClientAccessApi, IStaffAccessApi } from "@/api/security";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import {
  clientAccessCell, ClientAccessAction, STAFF_CLIENTS, StaffClient,
} from "@/types/security";
import { memo } from "react";
import { CLIENT_LABEL_KEY, ROLE_LABEL_KEY, STATUS_LOOK } from "./securityLabels";

/** The project's empty-value mark (never an em dash in rendered text). */
const EMPTY = "-";

interface CellProps {
  access: IClientAccessApi | undefined;
  client: StaffClient;
  busy: boolean;
  onAction: (client: StaffClient, action: ClientAccessAction) => void;
}

/**
 * One client of one person: the server's status as a badge, and the one
 * button that changes it. `allowed: false` draws the empty mark and no button
 * (the role can never have this client), with the reason as its tooltip.
 */
export const ClientAccessCell = ({ access, client, busy, onAction }: CellProps) => {
  const { t } = useLang();
  const cell = clientAccessCell(access);
  if (cell.kind === "unavailable") {
    return (
      <span className="muted" title={t("security.access.notAvailable")} aria-label={t("security.access.notAvailable")}>
        {EMPTY}
      </span>
    );
  }
  const look = STATUS_LOOK[cell.status];
  const clientName = t(CLIENT_LABEL_KEY[client]);
  return (
    <div className="sec-access-cell">
      <span className={`pill ${look.pill}`}>{t(look.key)}</span>
      <Button
        type="button"
        variant="secondary"
        className={`sec-btn${cell.action === "revoke" ? " is-danger" : ""}`}
        disabled={busy}
        onClick={() => onAction(client, cell.action)}
        aria-label={fmt(t(cell.action === "grant" ? "security.access.grantAria" : "security.access.revokeAria"), clientName)}
      >
        {t(cell.action === "grant" ? "security.access.grant" : "security.access.revoke")}
      </Button>
    </div>
  );
};

interface RowProps {
  row: IStaffAccessApi;
  busy: boolean;
  onAction: (row: IStaffAccessApi, client: StaffClient, action: ClientAccessAction) => void;
  onSessions: (row: IStaffAccessApi) => void;
}

/** One owner or manager. Memoised: typing in the search box re-renders the tab, not every row. */
const AccessRow = memo(({ row, busy, onAction, onSessions }: RowProps) => {
  const { t } = useLang();
  const companies = row.companies.map((c) => c.name).join(", ");
  const branches = row.branches.map((b) => b.address || `№${b.id}`).join(", ");
  return (
    <tr>
      <td data-label={t("security.col.user")}>
        <div className="sec-user">
          <span className="sec-user__name">{row.name}</span>
          <span className="meta">{row.email}</span>
          {row.telegram_username && <span className="meta">@{row.telegram_username}</span>}
        </div>
      </td>
      <td data-label={t("security.col.role")}>{t(ROLE_LABEL_KEY[row.role])}</td>
      <td data-label={t("security.col.workplace")}>
        <div className="sec-user">
          <span>{companies || EMPTY}</span>
          {branches && <span className="meta">{branches}</span>}
        </div>
      </td>
      {STAFF_CLIENTS.map((client) => (
        <td key={client} data-label={t(CLIENT_LABEL_KEY[client])}>
          <ClientAccessCell
            access={row.clients[client]}
            client={client}
            busy={busy}
            onAction={(c, action) => onAction(row, c, action)}
          />
        </td>
      ))}
      <td data-label={t("security.col.sessions")}>
        <Button type="button" variant="secondary" className="sec-btn" onClick={() => onSessions(row)}>
          {fmt(t("security.sessions.open"), row.sessions)}
        </Button>
      </td>
    </tr>
  );
});
AccessRow.displayName = "AccessRow";

export default AccessRow;
