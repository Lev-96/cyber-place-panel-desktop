import { useLang } from "@/i18n/LanguageContext";

/**
 * "Inactive" — the badge for a branch whose `status` is `inactive`, i.e. one
 * players can't see in the app.
 *
 * Callers gate it with `isBranchInactive(status)`, the same way the "Blocked"
 * pill is gated beside it, so each surface keeps its own separator and layout.
 * It reuses the booking `pending` pill (warning amber): the branch is switched
 * off, not broken — the danger red belongs to the block.
 *
 * The consequence ("players can't see it") rides on the tooltip; the branch
 * hub states it in full, where there is room for a sentence.
 */
const BranchStatusPill = () => {
  const { t } = useLang();
  return (
    <span className="pill pending" title={t("branch.inactive.hint")}>
      {t("branch.status.inactive")}
    </span>
  );
};

export default BranchStatusPill;
