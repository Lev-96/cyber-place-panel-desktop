import { useLang } from "@/i18n/LanguageContext";
import { BRANCH_STATUS, BranchStatus, branchStatusOf } from "@/types/branch";

/**
 * Per state: the pill class, the label and the tooltip.
 *
 * Inactive reuses the booking `pending` pill (warning amber): the branch is
 * switched off, not broken — the danger red belongs to the block. Active is the
 * `confirmed` green. The consequence ("players can / can't see it") rides on
 * the tooltip; the branch hub states the inactive one in full, where there is
 * room for a sentence.
 */
const LOOK = {
  [BRANCH_STATUS.Active]: { className: "pill confirmed", label: "branch.status.active", hint: "branch.active.hint" },
  [BRANCH_STATUS.Inactive]: { className: "pill pending", label: "branch.status.inactive", hint: "branch.inactive.hint" },
} as const satisfies Record<BranchStatus, { className: string; label: string; hint: string }>;

interface Props {
  /** The branch payload's `status`. Absent (an older backend) or null reads as Active. */
  status: BranchStatus | null | undefined;
}

/**
 * A branch's status, Active or Inactive — drawn for EVERY branch, so a list
 * reads "Branch 1 Active / Branch 2 Inactive" rather than leaving the active
 * ones blank. The one badge for this on every surface (branch lists, hub
 * header, settings page, the admin's owner page).
 */
const BranchStatusPill = ({ status }: Props) => {
  const { t } = useLang();
  const look = LOOK[branchStatusOf(status ?? undefined)];
  return (
    <span className={look.className} title={t(look.hint)}>
      {t(look.label)}
    </span>
  );
};

export default BranchStatusPill;
