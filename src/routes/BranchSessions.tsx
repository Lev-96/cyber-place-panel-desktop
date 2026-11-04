import SessionsBoard from "@/components/sessions/SessionsBoard";
import FitBoardToScreen from "@/preferences/FitBoardToScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { useParams } from "react-router-dom";

const BranchSessions = () => {
  const { branchId } = useParams();
  const { t } = useLang();
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;
  return (
    <ScreenWithBg bg="./bg/branch.jpg">
      {/* «Без прокрутки» (2026-11-03): beside the board, never inside it. */}
      <FitBoardToScreen />
      <SessionsBoard branchId={id} />
    </ScreenWithBg>
  );
};

export default BranchSessions;
