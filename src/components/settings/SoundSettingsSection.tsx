import SoundSettings from "@/components/appearance/SoundSettings";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useState } from "react";

/**
 * «Звуки уведомлений» in Settings (owner, 2026-11-09: moved here from the
 * interface screen). Each choice is saved at once, on its own request, so it
 * neither waits for nor discards an unsaved look on the interface screen. A
 * refused save puts the choice back and says so; volume and mute stay this
 * computer's own, as before.
 */
const SoundSettingsSection = () => {
  const { t } = useLang();
  const ui = useUiPreferencesOptional();
  const [failed, setFailed] = useState(false);
  if (!ui) return null;

  return (
    <div data-testid="settings-sound">
      <SoundSettings
        value={ui.prefs.sound}
        onChange={(next) => {
          setFailed(false);
          ui.saveSound(next).catch(() => setFailed(true));
        }}
      />
      {failed && <p className="error" role="alert">{t("appearance.saveFailed")}</p>}
    </div>
  );
};

export default SoundSettingsSection;
