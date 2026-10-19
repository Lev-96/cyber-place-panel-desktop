import { useLocation, useNavigate } from "react-router-dom";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";

/**
 * "Go back" for a not-found state: one step back in the app's own history,
 * or `fallback` (the dashboard by default) when the page was opened directly
 * and there is nothing to go back to. Needs the router.
 */
const BackAction = ({ fallback = "/" }: { fallback?: string }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  // The router marks the first entry of this window with the key "default".
  const goBack = () => (location.key === "default" ? navigate(fallback, { replace: true }) : navigate(-1));
  return <Button type="button" variant="secondary" onClick={goBack}>{t("state.notFound.back")}</Button>;
};

export default BackAction;
