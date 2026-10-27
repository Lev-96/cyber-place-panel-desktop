import ChoiceCards from "@/components/appearance/ChoiceCards";
import PresetPicture from "@/components/appearance/PresetPicture";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES, type Lang } from "@/i18n/translations";
import { useUiPreferences } from "@/preferences/UiPreferencesContext";
import {
  NEW_PERSON_PREFERENCES, PRESETS,
  type InterfaceId, type SoundProfile, type ThemeId, type UiPreferences,
} from "@/preferences/uiPreferences";
import { previewSound, stopPreview, unlockAudio } from "@/sound/soundEngine";
import { useEffect, useState } from "react";

/**
 * The first-run setup (2026-10-27): language, interface, theme and sound,
 * one short step at a time, for a person the SERVER says has not been set up
 * (`onboarding_version`) — never because this machine has no local copy, and
 * never again once finished, on any computer.
 *
 * It sits over the working panel rather than instead of it: bookings,
 * notifications and the console watcher keep running underneath. Each choice
 * is shown on the panel behind it as it is made. «Пропустить» takes the
 * recommended settings and finishes; «Позже» keeps the safe defaults for now
 * and offers the setup again at the next sign-in.
 */
const STEPS = ["language", "interface", "theme", "sound", "summary"] as const;
type Step = (typeof STEPS)[number];

const OnboardingWizard = () => {
  const { t, lang, setLang } = useLang();
  const { needsOnboarding, prefs, preview, finishOnboarding, deviceSound, setDeviceSound } = useUiPreferences();
  const [later, setLater] = useState(false);
  const [step, setStep] = useState<Step>("language");
  const [choice, setChoice] = useState<UiPreferences>(prefs);
  const [busy, setBusy] = useState(false);

  // Start from what the server offered a new person, once it is known.
  useEffect(() => { if (needsOnboarding) setChoice(prefs); }, [needsOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!needsOnboarding || later) return;
    preview(choice);
    return () => preview(null);
  }, [choice, needsOnboarding, later, preview]);
  useEffect(() => () => stopPreview(), []);

  if (!needsOnboarding || later) return null;

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]);
  const finish = async (prefsToKeep: UiPreferences) => {
    setBusy(true);
    stopPreview();
    try {
      await finishOnboarding(prefsToKeep);
    } catch {
      // Saved on this computer and shown; the server is told on the next save.
    } finally {
      setBusy(false);
    }
  };
  const tryVolume = async (profile: SoundProfile) => {
    // A click is also what lets the system play sound at all.
    await unlockAudio();
    previewSound("chime", profile, deviceSound.muted ? 0 : deviceSound.volume);
  };

  const interfaces: Array<{ key: Exclude<InterfaceId, "custom">; title: string; description: string }> = [
    { key: "simple", title: t("appearance.ui.simple"), description: t("appearance.ui.simpleDesc") },
    { key: "standard", title: t("appearance.ui.standard"), description: t("appearance.ui.standardDesc") },
    { key: "compact", title: t("appearance.ui.compact"), description: t("appearance.ui.compactDesc") },
  ];
  const themes: Array<{ key: ThemeId; title: string; description: string }> = [
    { key: "dark", title: t("appearance.theme.dark"), description: t("appearance.theme.darkDesc") },
    { key: "light", title: t("appearance.theme.light"), description: t("appearance.theme.lightDesc") },
    { key: "contrast", title: t("appearance.theme.contrast"), description: t("appearance.theme.contrastDesc") },
  ];
  const profiles: Array<{ key: SoundProfile; title: string; description: string }> = [
    { key: "quiet", title: t("sound.profile.quiet"), description: t("sound.profile.quietDesc") },
    { key: "standard", title: t("sound.profile.standard"), description: t("sound.profile.standardDesc") },
    { key: "loud", title: t("sound.profile.loud"), description: t("sound.profile.loudDesc") },
  ];

  return (
    <Modal open onClose={() => setLater(true)} closeOnBackdrop={false}>
      <div className="card onboarding" role="dialog" aria-labelledby="onboarding-title" data-testid="onboarding">
        <div className="onboarding__progress" aria-label={t("onboarding.progress").replace("{0}", String(index + 1)).replace("{1}", String(STEPS.length))}>
          {STEPS.map((s, i) => <span key={s} className={`onboarding__dot${i <= index ? " is-done" : ""}`} />)}
          <span className="muted onboarding__count">{t("onboarding.progress").replace("{0}", String(index + 1)).replace("{1}", String(STEPS.length))}</span>
        </div>
        <h2 id="onboarding-title" className="onboarding__title">{t(`onboarding.${step}.title`)}</h2>
        <p className="muted onboarding__hint">{t(`onboarding.${step}.hint`)}</p>

        {step === "language" && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label={t("onboarding.language.title")}>
            {LANGUAGES.map((l) => (
              <Button key={l.code} type="button" variant={lang === l.code ? "primary" : "secondary"}
                aria-pressed={lang === l.code} onClick={() => setLang(l.code as Lang)}>{l.name}</Button>
            ))}
          </div>
        )}
        {step === "interface" && (
          <ChoiceCards name="onb-interface" label={t("onboarding.interface.title")} value={choice.interface}
            choices={interfaces.map((c) => ({ ...c, picture: <PresetPicture id={c.key} /> }))}
            onChange={(key) => setChoice({ ...choice, interface: key, layout: { ...PRESETS[key as Exclude<InterfaceId, "custom">] } })} />
        )}
        {step === "theme" && (
          <ChoiceCards name="onb-theme" label={t("onboarding.theme.title")} value={choice.theme}
            choices={themes.map((c) => ({ ...c, picture: <span className={`theme-swatch theme-swatch--${c.key}`} /> }))}
            onChange={(theme) => setChoice({ ...choice, theme })} />
        )}
        {step === "sound" && (
          <div className="col" style={{ gap: 12 }}>
            <ChoiceCards name="onb-sound" label={t("onboarding.sound.title")}
              value={choice.sound.profile === "custom" ? "standard" : choice.sound.profile}
              choices={profiles}
              onChange={(profile) => setChoice({ ...choice, sound: { ...choice.sound, profile } })} />
            <label className="col sound-device__volume">
              <span className="label">{t("sound.volume")}: {deviceSound.volume}%</span>
              <input type="range" min={0} max={100} step={5} value={deviceSound.volume} aria-label={t("sound.volume")}
                onChange={(e) => setDeviceSound({ ...deviceSound, volume: Number(e.target.value) })} />
            </label>
            <div>
              <Button type="button" variant="secondary" onClick={() => void tryVolume(choice.sound.profile)}>▶ {t("onboarding.sound.try")}</Button>
            </div>
          </div>
        )}
        {step === "summary" && (
          <dl className="onboarding__summary">
            <dt>{t("onboarding.language.title")}</dt><dd>{LANGUAGES.find((l) => l.code === lang)?.name}</dd>
            <dt>{t("onboarding.interface.title")}</dt><dd>{t(`appearance.ui.${choice.interface}`)}</dd>
            <dt>{t("onboarding.theme.title")}</dt><dd>{t(`appearance.theme.${choice.theme}`)}</dd>
            <dt>{t("onboarding.sound.title")}</dt><dd>{t(`sound.profile.${choice.sound.profile}`)} · {deviceSound.volume}%</dd>
          </dl>
        )}

        <div className="onboarding__actions">
          <Button type="button" variant="secondary" onClick={() => setLater(true)} disabled={busy}>{t("onboarding.later")}</Button>
          {step !== "summary" && (
            <Button type="button" variant="secondary" onClick={() => void finish(NEW_PERSON_PREFERENCES)} disabled={busy}>
              {t("onboarding.skip")}
            </Button>
          )}
          <span style={{ flex: 1 }} />
          {index > 0 && <Button type="button" variant="secondary" onClick={back} disabled={busy}>{t("onboarding.back")}</Button>}
          {step === "summary" ? (
            <Button type="button" onClick={() => void finish(choice)} disabled={busy} data-testid="onboarding-finish">
              {busy ? t("appearance.saving") : t("onboarding.start")}
            </Button>
          ) : (
            <Button type="button" onClick={next}>{t("onboarding.next")}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingWizard;
