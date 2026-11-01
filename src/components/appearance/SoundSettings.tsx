import ChoiceCards from "@/components/appearance/ChoiceCards";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import SettingsSection from "@/components/ui/SettingsSection";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferences } from "@/preferences/UiPreferencesContext";
import {
  FILE_SOUNDS, SOUND_CATEGORIES, SYNTH_SOUNDS, defaultSound,
  type SoundCategory, type SoundId, type SoundPrefs, type SoundProfile,
} from "@/preferences/uiPreferences";
import { isAudioBlocked, onAudioBlockedChange, previewSound, soundLengthMs, stopPreview, unlockAudio } from "@/sound/soundEngine";
import { useEffect, useState } from "react";

/**
 * «Звуки уведомлений» (2026-10-27): how loud and which sound for each kind of
 * notification, heard before it is chosen.
 *
 * The profile and the per-kind choices belong to the person (saved with the
 * rest of the interface); the volume and mute belong to THIS computer — its
 * speakers, its room — and apply at once. Nothing here changes what arrives
 * or what is shown: a muted kind still shows its card and its badge.
 *
 * One choice sets the sound of every kind at once (owner, 2026-10-27); each
 * kind can still be set on its own below, and then the one choice reads
 * "different sounds".
 */
interface Props {
  value: SoundPrefs;
  onChange: (next: SoundPrefs) => void;
}

const SoundSettings = ({ value, onChange }: Props) => {
  const { t } = useLang();
  const { deviceSound, setDeviceSound } = useUiPreferences();
  const [playing, setPlaying] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(isAudioBlocked());

  useEffect(() => onAudioBlockedChange(setBlocked), []);
  // Leaving the screen stops whatever is being previewed.
  useEffect(() => () => stopPreview(), []);

  const play = (key: string, sound: SoundId) => {
    stopPreview();
    setPlaying(key);
    previewSound(sound, value.profile, deviceSound.muted ? 0 : deviceSound.volume);
    window.setTimeout(() => setPlaying((p) => (p === key ? null : p)), soundLengthMs(sound, value.profile) + 200);
  };
  const stop = () => { stopPreview(); setPlaying(null); };
  const setCategory = (c: SoundCategory, patch: Partial<SoundPrefs["categories"][SoundCategory]>) =>
    onChange({ ...value, categories: { ...value.categories, [c]: { ...value.categories[c], ...patch } } });
  const setAll = (sound: SoundId) =>
    onChange({
      ...value,
      categories: Object.fromEntries(SOUND_CATEGORIES.map((c) => [c, { ...value.categories[c], sound }])) as SoundPrefs["categories"],
    });
  // The one sound every kind uses, or null when they differ.
  const chosen = SOUND_CATEGORIES.map((c) => value.categories[c].sound);
  const common = chosen.every((s) => s === chosen[0]) ? chosen[0] : null;
  const [eachOpen, setEachOpen] = useState(common === null);
  const options = (
    <>
      <optgroup label={t("sound.group.melodies")}>
        {FILE_SOUNDS.map((s) => <option key={s} value={s}>{t(`sound.name.${s}`)}</option>)}
      </optgroup>
      <optgroup label={t("sound.group.signals")}>
        {SYNTH_SOUNDS.map((s) => <option key={s} value={s}>{t(`sound.name.${s}`)}</option>)}
      </optgroup>
    </>
  );
  const listen = (key: string, sound: SoundId) => (playing === key ? (
    <Button type="button" variant="secondary" onClick={stop}>■ {t("sound.stop")}</Button>
  ) : (
    <Button type="button" variant="secondary" onClick={() => play(key, sound)} disabled={deviceSound.muted}>▶ {t("sound.listen")}</Button>
  ));

  const profiles: Array<{ key: SoundProfile; title: string; description: string }> = [
    { key: "quiet", title: t("sound.profile.quiet"), description: t("sound.profile.quietDesc") },
    { key: "standard", title: t("sound.profile.standard"), description: t("sound.profile.standardDesc") },
    { key: "loud", title: t("sound.profile.loud"), description: t("sound.profile.loudDesc") },
    { key: "custom", title: t("sound.profile.custom"), description: t("sound.profile.customDesc") },
  ];

  return (
    <SettingsSection title={t("sound.title")} description={t("sound.hint")}>
      {blocked && (
        <div className="state-notice sound-blocked" role="status" data-testid="sound-blocked">
          <span>{t("sound.blocked")}</span>
          <Button type="button" variant="secondary" onClick={() => void unlockAudio()}>{t("sound.unlock")}</Button>
        </div>
      )}

      <ChoiceCards
        name="sound-profile"
        label={t("sound.profile.title")}
        value={value.profile}
        onChange={(profile) => onChange({ ...value, profile })}
        choices={profiles}
      />

      <div className="sound-device">
        <label className="col sound-device__volume">
          <span className="label">{t("sound.volume")}: {deviceSound.volume}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={deviceSound.volume}
            onChange={(e) => setDeviceSound({ ...deviceSound, volume: Number(e.target.value) })}
            aria-label={t("sound.volume")}
            data-testid="sound-volume"
          />
        </label>
        <Checkbox
          checked={deviceSound.muted}
          onChange={(muted) => { if (muted) stop(); setDeviceSound({ ...deviceSound, muted }); }}
          label={t("sound.mute")}
        />
        <span className="muted appearance-note">{t("sound.deviceNote")}</span>
      </div>

      <div className="sound-row sound-all" data-testid="sound-all">
        <span className="sound-row__name label">{t("sound.all")}</span>
        <span>
          <select
            className="input"
            value={common ?? ""}
            onChange={(e) => setAll(e.target.value as SoundId)}
            aria-label={t("sound.all")}
          >
            {common === null && <option value="" disabled>{t("sound.mixed")}</option>}
            {options}
          </select>
        </span>
        <span className="sound-row__play">{listen("all", common ?? chosen[0])}</span>
      </div>

      <details className="sound-each" open={eachOpen} onToggle={(e) => setEachOpen(e.currentTarget.open)}>
        <summary>{t("sound.each")}</summary>
      <div className="sound-table" role="table" aria-label={t("sound.categories")}>
        {SOUND_CATEGORIES.map((c) => {
          const row = value.categories[c];
          const key = `cat:${c}`;
          return (
            <div key={c} className={`sound-row${row.enabled ? "" : " is-off"}`} role="row" data-testid={`sound-row-${c}`}>
              <span className="sound-row__name" role="cell">
                <Checkbox checked={row.enabled} onChange={(enabled) => setCategory(c, { enabled })} label={t(`sound.category.${c}`)} />
              </span>
              <span role="cell">
                <select
                  className="input"
                  value={row.sound}
                  onChange={(e) => setCategory(c, { sound: e.target.value as SoundId })}
                  aria-label={`${t("sound.which")}: ${t(`sound.category.${c}`)}`}
                  disabled={!row.enabled}
                >
                  {options}
                </select>
              </span>
              <span role="cell" className="sound-row__play">{listen(key, row.sound)}</span>
            </div>
          );
        })}
      </div>
      </details>
      <span className="muted appearance-note">{t("sound.alwaysVisible")}</span>
      <div>
        <Button type="button" variant="secondary" onClick={() => onChange(defaultSound())}>{t("sound.restore")}</Button>
      </div>
    </SettingsSection>
  );
};

export default SoundSettings;
