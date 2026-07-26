import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { accountSwitchRepository } from "@/repositories/AccountSwitchRepository";
import { useState } from "react";

/** Above this many accounts a filter field appears — below it just gets in the way. */
const FILTER_THRESHOLD = 5;

interface Props {
  /** Return to the account menu. */
  onBack: () => void;
  /** The operator picked an account to sign in as. */
  onPick: (target: IAccountSwitchTarget) => void;
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
};

const haystack = (a: IAccountSwitchTarget): string =>
  `${a.name} ${a.email} ${a.branch?.address ?? ""} ${a.branch?.city ?? ""}`.toLowerCase();

/**
 * The accounts the signed-in user may hand the panel over to, rendered INSIDE
 * the account popover (same surface, no navigation) — picking one hands off to
 * the password step.
 *
 * Role-agnostic on purpose: an owner sees his managers and a manager sees his
 * owner plus the colleagues of the same company, but that scoping is decided
 * by the backend (`GET /account-switch/targets`), never here. So this stays one
 * component for both directions and cannot drift into a client-side rule that
 * shows an account the server would not have offered.
 */
const AccountSwitchPanel = ({ onBack, onPick }: Props) => {
  const { t } = useLang();
  const { data, loading } = useAsync(() => accountSwitchRepository.targets(), []);
  const [query, setQuery] = useState("");

  const all = data ?? [];
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((a) => haystack(a).includes(q)) : all;

  return (
    <div className="cp-switch">
      <div className="cp-switch-head">
        <button type="button" className="cp-switch-back" onClick={onBack} aria-label={t("action.back")}>
          ←
        </button>
        <span className="cp-switch-title">{t("switchAccount.title")}</span>
      </div>

      {all.length > FILTER_THRESHOLD && (
        <input
          className="input cp-switch-filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("switchAccount.filter")}
          aria-label={t("switchAccount.filter")}
        />
      )}

      <div className="cp-switch-list">
        {loading && (
          <div className="col" style={{ gap: 8, padding: 4 }} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: "center" }}>
                <Skeleton width={32} height={32} radius={999} />
                <div className="col" style={{ gap: 6, flex: 1 }}>
                  <Skeleton width="55%" height={11} />
                  <Skeleton width="80%" height={9} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && shown.length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: "6px 4px" }}>
            {all.length === 0 ? t("switchAccount.empty") : t("switchAccount.noMatch")}
          </div>
        )}

        {!loading && shown.map((account) => (
          <button
            key={account.id}
            type="button"
            className="cp-switch-item"
            onClick={() => onPick(account)}
            title={account.email}
          >
            <span
              className={`cp-switch-avatar${account.role === "company_owner" ? " is-owner" : ""}`}
              aria-hidden
            >
              {initials(account.name || account.email)}
            </span>
            <span className="cp-switch-text">
              <span className="cp-switch-name">{account.name || t("switchAccount.unnamed")}</span>
              <span className="cp-switch-meta">{account.email}</span>
              {account.branch && <span className="cp-switch-meta">{account.branch.address}</span>}
            </span>
            <span className={`cp-switch-role${account.role === "company_owner" ? " is-owner" : ""}`}>
              {t(`role.${account.role}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AccountSwitchPanel;
