import { useLang } from "@/i18n/LanguageContext";
import { useOnline } from "@/hooks/useOnline";

/**
 * A quiet pill while the machine reports no network. It changes nothing and
 * asks for nothing: what is on screen stays (reads keep their last data), and
 * the screens' own polling / realtime resync bring it up to date afterwards.
 */
const OfflineNotice = () => {
  const { t } = useLang();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="cp-offline-notice" role="status">
      <svg className="cp-offline-notice__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 9 Q12 1 21 9 M6 12.5 Q12 7 18 12.5 M9 16 Q12 13.5 15 16 M4 4 L20 20" />
      </svg>
      <span>{t("state.offline.notice")}</span>
    </div>
  );
};

export default OfflineNotice;
