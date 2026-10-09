import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useFitsInline } from "@/hooks/useFitsInline";
import { useLang } from "@/i18n/LanguageContext";
import { KNOWN_PLATFORMS, isKnownPlatform, platformLabel, slugifyPlatform } from "@/utils/platform";
import { useId, useMemo, useState } from "react";

/** A platform offered as a quick button: its slug and the name staff read. */
export interface PlatformOption {
  slug: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (platform: string) => void;
  disabled?: boolean;
  /**
   * Existing custom-platform slugs to autocomplete in the "Other" slug box.
   * Only meaningful where that box is shown (GameForm); PlaceForm hides it.
   */
  suggestions?: string[];
  /**
   * Suppress the built-in "Other" slug text input, keeping only the options +
   * the Other choice. The parent then owns the custom-platform input (e.g.
   * PlaceForm's multilingual наименование, from which it derives the slug).
   */
  hideOtherInput?: boolean;
  /**
   * The branch's custom platforms (billiards, poker, …), offered after PS5 so
   * re-using one is a click instead of re-typing its slug. Both GameForm and
   * PlaceForm pass them (`customPlatformOptions`, `i18n/platformPriceName.ts`);
   * known slugs and duplicates are ignored.
   */
  customOptions?: readonly PlatformOption[];
}

/** The select's value for "Other": a string no slug can be (slugs start alphanumeric). */
const OTHER = "-other";

/**
 * Dynamic platform selector shared by PlaceForm and GameForm — the single
 * place a platform is chosen in the panel; reuse it, don't hand-roll the
 * known-vs-custom toggle per form.
 *
 * ONE ordered list: PC, PS4, PS5, the branch's custom platforms, then Other
 * (which reveals a slug box, or hands the naming to the parent). Drawn as one
 * row of buttons when that row fits on a single line, and as a native select
 * (`select.input`, the app's select idiom) when it does not — a 960 px window,
 * the owner web build at 360 px, Armenian labels, eight custom platforms. The
 * switch is measured (`useFitsInline`), never guessed from a count, and it is
 * presentation only: the value, the parent and the Other state survive it.
 */
const PlatformPicker = ({ value, onChange, disabled, suggestions, hideOtherInput, customOptions }: Props) => {
  const { t, lang } = useLang();
  const listId = useId();

  const options = useMemo<PlatformOption[]>(() => {
    const seen = new Set<string>(KNOWN_PLATFORMS);
    const customs = (customOptions ?? []).filter((o) => {
      if (!o.slug || seen.has(o.slug)) return false;
      seen.add(o.slug);
      return true;
    });
    return [...KNOWN_PLATFORMS.map((slug) => ({ slug, label: platformLabel(slug) })), ...customs];
  }, [customOptions]);
  const listed = (slug: string) => options.some((o) => o.slug === slug);

  // Other is DERIVED, not snapshotted: the operator chose it, or the value is
  // a slug the list does not offer. A snapshot taken on mount kept a value on
  // Other for good when its custom button arrived a moment later (async list).
  const [userChoseOther, setUserChoseOther] = useState(false);
  const unlisted = value !== "" && !listed(value);
  const otherMode = userChoseOther || unlisted;
  // A saved slug nobody offers any more is shown as itself, never as a blank.
  const legacy = !userChoseOther && unlisted ? value : null;

  const otherLabel = t("platform.other");
  const { containerRef, measureRef, fits } = useFitsInline([options, otherLabel, lang]);

  const pick = (slug: string) => {
    setUserChoseOther(false);
    onChange(slug);
  };
  const chooseOther = () => {
    setUserChoseOther(true);
    onChange("");
  };

  const slugOptions = Array.from(new Set((suggestions ?? []).filter((s) => s && !isKnownPlatform(s)))).sort();
  const pressed = (slug: string) => !otherMode && value === slug;

  return (
    <div className="col platform-picker">
      <div ref={containerRef} className="platform-picker__fit">
        {fits ? (
          <div className="platform-picker__row" role="group" aria-label={t("label.platform")}>
            {options.map((o) => (
              <Button
                key={o.slug}
                type="button"
                variant={pressed(o.slug) ? "primary" : "secondary"}
                aria-pressed={pressed(o.slug)}
                onClick={() => pick(o.slug)}
                disabled={disabled}
                title={o.label}
              >
                {o.label}
              </Button>
            ))}
            <Button
              type="button"
              variant={otherMode ? "primary" : "secondary"}
              aria-pressed={otherMode}
              onClick={chooseOther}
              disabled={disabled}
            >
              {otherLabel}
            </Button>
          </div>
        ) : (
          <select
            className="input platform-picker__select"
            aria-label={t("label.platform")}
            value={legacy ?? (otherMode ? OTHER : value)}
            onChange={(e) => (e.target.value === OTHER ? chooseOther() : pick(e.target.value))}
            disabled={disabled}
          >
            {/* A fresh form with nothing picked yet: say so, rather than let
                the browser show (and imply) the first option. */}
            {value === "" && !otherMode && <option value="" disabled>-</option>}
            {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
            {legacy && <option value={legacy}>{platformLabel(legacy)}</option>}
            <option value={OTHER}>{t("platform.otherOption")}</option>
          </select>
        )}
        {/* The full row at its natural width, always rendered so the measure
            never depends on the mode it decides. Invisible, inert, and AFTER
            the real control so a document-order query finds the real one. */}
        <div className="platform-picker__measure-clip" aria-hidden="true" inert>
          <div ref={measureRef} className="platform-picker__row platform-picker__row--measure">
            {options.map((o) => (
              <Button key={o.slug} type="button" variant="secondary" tabIndex={-1}>{o.label}</Button>
            ))}
            <Button type="button" variant="secondary" tabIndex={-1}>{otherLabel}</Button>
          </div>
        </div>
      </div>

      {otherMode && !hideOtherInput && (
        <>
          <Input
            placeholder={t("platform.customPlaceholder")}
            value={value}
            onChange={(e) => onChange(slugifyPlatform(e.target.value))}
            disabled={disabled}
            autoFocus
            list={slugOptions.length ? listId : undefined}
            autoComplete="off"
          />
          {slugOptions.length > 0 && (
            <datalist id={listId}>
              {slugOptions.map((s) => (
                <option key={s} value={s} label={platformLabel(s)} />
              ))}
            </datalist>
          )}
        </>
      )}
    </div>
  );
};

export default PlatformPicker;
