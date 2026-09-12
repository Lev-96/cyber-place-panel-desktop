import type { IOwnerCompanyApi } from "@/api/owners";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { Link } from "react-router-dom";

interface Props {
  company: IOwnerCompanyApi;
  /** Extra class for where it sits: `meta` in a list row, the card head on the owner page. */
  className?: string;
}

/**
 * One of an owner's companies in a line: its name opens the EXISTING company
 * page, then the branch and manager counts, the company status and the block.
 * Shared by the Owners list row and the owner's own page, so both say the same
 * thing about a company in the same order.
 */
const OwnerCompanyLine = ({ company: c, className = "meta" }: Props) => {
  const { t } = useLang();
  return (
    <div className={`owner-company-line ${className}`}>
      <Link to={`/companies/${c.id}`} title={t("owners.openCompany")}>{c.name}</Link>
      <span>{fmt(t("owners.branches"), c.branches_count)}</span>
      <span>{fmt(t("owners.managers"), c.managers_count)}</span>
      <span className={`pill ${c.status}`}>{t(`company.status.${c.status}`)}</span>
      {c.is_blocked && <span className="pill blocked">{t("blocking.state.company")}</span>}
    </div>
  );
};

export default OwnerCompanyLine;
