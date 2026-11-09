import SessionsBoard from "@/components/sessions/SessionsBoard";
import FitBoardToScreen from "@/preferences/FitBoardToScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { useParams } from "react-router-dom";
import BillingLockOverlay from "@/components/platformBilling/BillingLockOverlay";
import { useBillingAccess } from "@/components/platformBilling/useBillingAccess";

const BranchSessions = () => {
  const { branchId } = useParams();
  const { t } = useLang();
  const id = Number(branchId);
  // An unpaid Cyber Place Platform invoice: say so before Start is pressed (2026-11-09).
  const billingAccess = useBillingAccess(Number.isFinite(id) && id > 0 ? id : null);
  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;
  return (
    <ScreenWithBg bg="./bg/branch.jpg">
      {/* «Без прокрутки» (2026-11-03): beside the board, never inside it. */}
      <FitBoardToScreen />
      <SessionsBoard branchId={id} />
      <BillingLockOverlay access={billingAccess} area="sessions" />
    </ScreenWithBg>
  );
};

export default BranchSessions;
