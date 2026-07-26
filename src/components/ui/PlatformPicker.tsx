import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { KNOWN_PLATFORMS, isKnownPlatform, platformLabel, slugifyPlatform } from "@/utils/platform";
import { useId, useState } from "react";

interface Props {
  value: string;
  onChange: (platform: string) => void;
  disabled?: boolean;
  /**
   * Existing custom-platform slugs to autocomplete in "Other" mode. Lets an
   * operator re-pick a platform they already created (type "t" → "tennis")
   * instead of re-inventing the slug and fragmenting the catalogue.
   */
  suggestions?: string[];
  /**
   * Suppress the built-in "Other" slug text input, keeping only the known
   * buttons + the Other toggle. The parent then owns the custom-platform input
   * (e.g. PlaceForm's multilingual наименование, from which it derives the
   * slug). GameForm doesn't pass this, so its behaviour is unchanged.
   */
  hideOtherInput?: boolean;
}

/**
 * Dynamic platform selector shared by PlaceForm and GameForm. The three known
 * platforms are quick buttons; "Other" reveals a slug input so a branch can
 * register a custom platform (table tennis, poker, …). Single source of truth
 * for how a platform is chosen anywhere in the panel — reuse it, don't
 * hand-roll the known-vs-custom toggle per form.
 */
const PlatformPicker = ({ value, onChange, disabled, suggestions, hideOtherInput }: Props) => {
  const { t } = useLang();
  const listId = useId();
  // Distinct, sorted custom-platform slugs to offer as autocomplete options.
  const options = Array.from(new Set((suggestions ?? []).filter((s) => s && !isKnownPlatform(s)))).sort();
  // "Other" is active when the current value isn't one of the known platforms.
  // An empty value defaults to the known row so a fresh form starts simple.
  const [otherMode, setOtherMode] = useState<boolean>(value !== "" && !isKnownPlatform(value));

  const pickKnown = (p: string) => {
    setOtherMode(false);
    onChange(p);
  };

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {KNOWN_PLATFORMS.map((p) => (
          <Button
            key={p}
            type="button"
            variant={!otherMode && value === p ? "primary" : "secondary"}
            onClick={() => pickKnown(p)}
            disabled={disabled}
            style={{ flex: 1, minWidth: 72 }}
          >
            {p.toUpperCase()}
          </Button>
        ))}
        <Button
          type="button"
          variant={otherMode ? "primary" : "secondary"}
          onClick={() => { setOtherMode(true); onChange(""); }}
          disabled={disabled}
          style={{ flex: 1, minWidth: 72 }}
        >
          {t("platform.other")}
        </Button>
      </div>
      {otherMode && !hideOtherInput && (
        <>
          <Input
            placeholder={t("platform.customPlaceholder")}
            value={value}
            onChange={(e) => onChange(slugifyPlatform(e.target.value))}
            disabled={disabled}
            autoFocus
            list={options.length ? listId : undefined}
            autoComplete="off"
          />
          {options.length > 0 && (
            <datalist id={listId}>
              {options.map((s) => (
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
