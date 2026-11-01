import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Interface edits left unsaved (2026-10-27): the person walked away from
 * «Интерфейс и тема» mid-change. The panel shows the saved look; this says
 * the edits are still there and offers to go back to them or drop them.
 * Never shown on the screen itself, and never when nothing is pending.
 */
const UnsavedInterfaceNotice = () => {
  const ui = useUiPreferencesOptional();
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!ui?.draft || pathname === "/appearance") return null;
  return (
    <div className="unsaved-notice" role="status" data-testid="unsaved-interface">
      <span>{t("appearance.unsavedAway")}</span>
      <Button type="button" variant="secondary" onClick={() => navigate("/appearance")}>{t("appearance.backToEdits")}</Button>
      <Button type="button" variant="secondary" onClick={ui.discardDraft}>{t("appearance.dropEdits")}</Button>
    </div>
  );
};

export default UnsavedInterfaceNotice;
