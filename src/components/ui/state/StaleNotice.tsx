import { useLang } from "@/i18n/LanguageContext";
import { useOnline } from "@/hooks/useOnline";
import { classifyError } from "./viewState";

/**
 * One line above data that is still on screen after a refresh failed: the
 * operator keeps working from it, and knows it may be behind.
 */
const StaleNotice = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => {
  const { t } = useLang();
  const online = useOnline();
  const offline = classifyError(error, online) === "offline";
  return (
    <div className="cp-stale" role="status">
      <span>{t(offline ? "state.stale.offline" : "state.stale.failed")}</span>
      {onRetry && (
        <button type="button" className="cp-stale__retry" onClick={onRetry}>{t("action.retry")}</button>
      )}
    </div>
  );
};

export default StaleNotice;
