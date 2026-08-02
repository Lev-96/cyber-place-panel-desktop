import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { IBranchPlatformPrice } from "@/types/api";
import { matchPlatforms, sanitizeForLang } from "@/utils/platformName";
import { useAutoTranslate } from "@/i18n/useAutoTranslate";
import { useCallback, useState } from "react";

export interface LangNames {
  en: string;
  ru: string;
  am: string;
}

interface Props {
  value: LangNames;
  onChange: (v: LangNames) => void;
  /** Existing custom-platform prices, used to autocomplete наименования. */
  suggestions?: IBranchPlatformPrice[];
  /**
   * Fired when the operator clicks a suggestion. The parent adopts that
   * existing platform (fills every locale + locks its already-defined price),
   * so re-picking a platform works from any language it was named in.
   */
  onPickExisting?: (p: IBranchPlatformPrice) => void;
}

/** Human language names — shown as the field chip and inside the placeholder. */
const LANG_LABEL: Record<Lang, string> = { en: "English", ru: "Русский", am: "Հայերեն" };

/**
 * Smart multilingual наименование entry for a new custom platform.
 *
 * The operator's own UI language leads: only that one input shows first. As
 * soon as they type, the remaining two languages reveal below so the label is
 * complete in every locale. Each field accepts ONLY its own alphabet.
 *
 * Typing in the leading field auto-translates into the other two (shared logic
 * in {@link useAutoTranslate}); either can then be corrected by hand, which
 * pins it. Adopting a suggestion replaces all three at once and clears any pin,
 * because the platform's own names then win over anything typed so far.
 *
 * EVERY field autocompletes against existing platforms, and a match is found
 * across ALL locales of a platform — so typing "Т" / "т" (or the name in any
 * language, any case) surfaces the same платформа no matter which box you are
 * in. Picking a suggestion fills all three locales and selects that platform,
 * which locks its existing price (no new rate) and makes it impossible to fork
 * a duplicate by changing case.
 */
const PlatformNameInput = ({ value, onChange, suggestions, onPickExisting }: Props) => {
  const { t, lang } = useLang();

  // Primary = the panel language. Among the rest, English comes first because
  // it is the platform's identity (its slug is derived from it), then the third.
  const others: Lang[] = (["en", "ru", "am"] as Lang[])
    .filter((l) => l !== lang)
    .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : 0));
  const revealOthers = value[lang].trim().length > 0;

  // Which field currently owns the suggestion dropdown (the focused one).
  const [focused, setFocused] = useState<Lang | null>(null);

  // Auto-fills the non-leading languages. `sanitize` is passed through so a
  // machine translation lands under the same alphabet rule as typed text —
  // otherwise the English box could receive Cyrillic and the slug (this
  // platform's identity) would be built from it.
  const sanitize = useCallback((l: Lang, v: string) => sanitizeForLang(l, v), []);
  const auto = useAutoTranslate({
    values: value,
    onChange,
    primary: lang,
    secondary: others,
    fieldClass: "platform_name",
    maxChars: 60,
    sanitize,
  });

  const set = (l: Lang, v: string) =>
    l === lang
      ? auto.setPrimary(sanitizeForLang(l, v))
      : auto.setSecondary(l, sanitizeForLang(l, v));

  const field = (l: Lang, autoFocus = false) => {
    // Match this field's text across ALL locales — typing in any input finds
    // the same platform, first letter, any case.
    const matches = matchPlatforms(suggestions, value[l]);
    const showSuggestions = focused === l && matches.length > 0;

    return (
      <div className="col" style={{ gap: 4 }}>
        <span className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {LANG_LABEL[l]}
          {l === "en" && lang !== "en" && (
            <span className="muted" style={{ fontSize: 10, fontWeight: 400 }}>· {t("platformName.enIdHint")}</span>
          )}
        </span>
        <Input
          placeholder={`${t("platformName.placeholder")} · ${LANG_LABEL[l]}`}
          value={value[l]}
          onChange={(e) => set(l, e.target.value)}
          onFocus={() => setFocused(l)}
          onBlur={() => setFocused((f) => (f === l ? null : f))}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <div className="cp-mli-note" style={{ paddingLeft: 0 }}>
          {l === lang && auto.busy && <span className="cp-mli-busy">{t("multilang.translating")}</span>}
          {l !== lang && auto.locked[l] && (
            <button type="button" className="cp-mli-reset" onClick={() => auto.releaseLock(l)}>
              {t("multilang.edited")} · {t("multilang.reset")}
            </button>
          )}
          {l !== lang && !auto.locked[l] && auto.failed.includes(l) && (
            <span className="cp-mli-failed">{t("multilang.failed")}</span>
          )}
        </div>
        {showSuggestions && (
          <div
            className="col"
            style={{ border: "1px solid #1f2a44", borderRadius: 8, overflow: "hidden", background: "#0b1327" }}
          >
            <span className="muted" style={{ fontSize: 10, padding: "4px 8px 0" }}>{t("platformName.suggestions")}</span>
            {matches.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                className="row-between"
                // mousedown before blur — keep focus so the click always fires.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Replace every language at once and drop any pin: the
                  // platform's stored names now own the field, and a request
                  // still in flight must not overwrite them.
                  auto.adopt({ en: p.name_en ?? "", ru: p.name_ru ?? "", am: p.name_am ?? "" });
                  onPickExisting?.(p);
                }}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: "6px 8px",
                }}
              >
                <span>{platformPriceNameOf(p, lang)}</span>
                <span className="muted" style={{ fontSize: 11 }}>{p.name_en}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="label">{t("place.priceName")}</span>

      {field(lang, true)}

      {/* The other locales reveal once the primary field has text — a smooth
          fade + slide (opacity/transform per the desktop CSS standard), with
          max-height so the collapsed state takes no layout space. Kept mounted
          so typing in a secondary field never remounts / loses focus. */}
      <div
        aria-hidden={!revealOthers}
        style={{
          overflow: "hidden",
          maxHeight: revealOthers ? 1000 : 0,
          opacity: revealOthers ? 1 : 0,
          transform: revealOthers ? "translateY(0)" : "translateY(-6px)",
          transition: "max-height 260ms ease, opacity 200ms ease, transform 200ms ease",
          pointerEvents: revealOthers ? "auto" : "none",
        }}
      >
        <div className="col" style={{ gap: 8, paddingLeft: 10, borderLeft: "2px solid #1f2a44", paddingTop: 8 }}>
          {others.map((l) => (
            <div key={l}>{field(l)}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformNameInput;
