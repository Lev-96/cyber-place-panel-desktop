import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import { useLang } from "@/i18n/LanguageContext";
import { useParams } from "react-router-dom";

const BranchLive = () => {
  const { branchId } = useParams();
  const { t } = useLang();
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidBranchId")}</div>;
  return <BranchLiveScreen branchId={id} />;
};

export default BranchLive;
