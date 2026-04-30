import { useLang } from "@/i18n/LanguageContext";
import { useLocation, useNavigate } from "react-router-dom";

const BackButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  if (location.pathname === "/") return null;

  return (
    <button
      type="button"
      className="cp-back-btn"
      onClick={() => navigate(-1)}
      aria-label={t("common.back")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{t("common.back")}</span>
    </button>
  );
};

export default BackButton;
