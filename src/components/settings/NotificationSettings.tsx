import SettingsSection from "@/components/ui/SettingsSection";
import Switch from "@/components/ui/Switch";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import {
  effectiveNotifications,
  type NotificationPrefs,
} from "@/preferences/uiPreferences";
import { useState } from "react";

/**
 * The kinds an owner no longer chooses here (2026-11-09): the seat and booking
 * feed is the manager's, so for an owner they are off. Written as off with
 * every save, so a first save never stores them "on" from a legacy default.
 */
const OWNER_OFF: Pick<NotificationPrefs["categories"], "bookings" | "sessions" | "support" | "system"> = {
  bookings: { enabled: false },
  sessions: { enabled: false },
  support: { enabled: false },
  system: { enabled: false },
};

/**
 * «Уведомления» in Settings (owner, 2026-11-09): Cyber Place Platform payment
 * notices and their channels — the only kind an owner chooses (the rest are
 * off for an owner; sounds have their own section). Saved with the person's preference document (`PUT
 * /user/preferences`, `data.notifications`) on every switch.
 *
 * The server owns the policy: overdue, restriction, suspension and restore
 * notices are mandatory and reach the owner whatever is switched here — the
 * section says so in one line rather than offering a switch that does nothing.
 *
 * Against a backend that predates the setting the save is refused (the whole
 * document, for the unknown key): the switch goes back, the error is shown, and
 * the rest of the screen keeps working.
 */
const NotificationSettings = () => {
  const { t } = useLang();
  const ui = useUiPreferencesOptional();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!ui) return null;

  const current = effectiveNotifications(ui.prefs);
  const pb = current.categories.platform_billing;

  const save = async (next: NotificationPrefs) => {
    setBusy(true);
    setFailed(false);
    setSaved(false);
    try {
      await ui.saveNotifications(next);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const setBilling = (patch: Partial<typeof pb>) =>
    void save({ categories: { ...OWNER_OFF, platform_billing: { ...pb, ...patch } } });

  return (
    <SettingsSection title={t("settings.notifications.title")} description={t("settings.notifications.description")}>
      <div className="notification-settings" data-testid="notification-settings">
        <Switch
          size="md"
          checked={pb.enabled}
          onChange={(on) => setBilling({ enabled: on })}
          label={t("settings.notifications.platformBilling")}
          disabled={busy}
          testId="notif-platform_billing"
        />
        <div className="notification-settings__channels">
          <Switch
            checked={pb.email}
            onChange={(on) => setBilling({ email: on })}
            label={t("settings.notifications.email")}
            disabled={busy || !pb.enabled}
            testId="notif-platform_billing-email"
          />
          <Switch
            checked={pb.telegram}
            onChange={(on) => setBilling({ telegram: on })}
            label={t("settings.notifications.telegram")}
            disabled={busy || !pb.enabled}
            testId="notif-platform_billing-telegram"
          />
        </div>
        <p className="muted notification-settings__mandatory">{t("settings.notifications.mandatory")}</p>
        {failed && <div className="error" role="alert">{t("settings.notifications.saveFailed")}</div>}
        {saved && !failed && <div className="muted" role="status">{t("settings.notifications.saved")}</div>}
      </div>
    </SettingsSection>
  );
};

export default NotificationSettings;
