import BranchStatusPill from "@/components/branches/BranchStatusPill";
import { useLang } from "@/i18n/LanguageContext";
import type { BranchStatus } from "@/types/branch";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  /** Where the row opens: the branch's hub. */
  to: string;
  /** The branch as a name: its address, or whatever the list leads with. */
  title: string;
  /** The line under the name (city, counts). */
  meta?: ReactNode;
  /** The branch payload's `status`; absent or null reads as Active. */
  status: BranchStatus | null | undefined;
  /** The "Blocked" pill's text when the branch is blocked; nothing otherwise. */
  blockedLabel?: string | null;
  /** Drawn before the text, e.g. the branch logo. */
  leading?: ReactNode;
}

/**
 * One branch in a list: name and meta on the left, the state pills in their
 * own column on the right, then "Open".
 *
 * The pills are a SEPARATE flex item, never a run of text inside the name.
 * Inline they were glued to the address ("Abovyan 5Active") and moved with
 * every line break. In a column they line up down the list, so an inactive or
 * blocked branch reads at a glance. The text block is the one item that
 * shrinks (min-width: 0) and wraps, so a long address can never push a pill
 * out of the row or clip it.
 *
 * Status is always last in the group, right next to "Open", so it sits in the
 * same place on every row. "Blocked" goes to its left and only when it applies.
 */
const BranchListRow = ({ to, title, meta, status, blockedLabel, leading }: Props) => {
  const { t } = useLang();
  return (
    <Link to={to} className="list-item branch-row">
      {leading}
      <div className="branch-row__text">
        <div className="name branch-row__name">{title}</div>
        {meta != null && <div className="meta">{meta}</div>}
      </div>
      <div className="branch-row__pills">
        {blockedLabel && <span className="pill blocked">{blockedLabel}</span>}
        <BranchStatusPill status={status} />
      </div>
      <span className="muted branch-row__open">{t("common.open")}</span>
    </Link>
  );
};

export default BranchListRow;
