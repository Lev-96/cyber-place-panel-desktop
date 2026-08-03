import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { IBranchSubplatform } from "@/types/api";
import { useAutoTranslate } from "@/i18n/useAutoTranslate";
import { LangNames } from "@/components/ui/PlatformNameInput";
import { useState } from "react";

interface Props {
  value: LangNames;
  onChange: (v: LangNames) => void;
  /** Subplatforms of this platform, matched across every locale. */
  suggestions?: IBranchSubplatform[];
  /** Fired when an existing one is picked — the parent selects it instead. */
  onPickExisting?: (s: IBranchSubplatform) => void;
  disabled?: boolean;
}

/** Human language names — shown as the field chip and inside the placeholder. */
const LANG_LABEL: Record<Lang, string> = { en: "English", ru: "Русский", am: "Հայերեն" };

/** Match a query against every locale of a subplatform, case-insensitively. */
export const matchSubplatforms = (
  all: IBranchSubplatform[] | undefined,
  query: string,
): IBranchSubplatform[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return (all ?? []).filter((s) =>
    [s.name_en, s.name_ru, s.name_am].some((n) => (n ?? "").toLowerCase().includes(q)),
  );
};

/**
 * The "Other" field: one input that either finds an existing subcategory or
 * starts a new one.
 *
 * Same shape as {@link PlatformNameInput}, because to an operator these are the
 * same gesture — name a thing, and either it already exists or it does not. One
 * box in the panel language, suggestions as they type, and the other two
 * languages appearing only once it is clear they are creating something new.
 *
 * "Clear they are creating something new" is the part worth stating: the extra
 * fields reveal when the text matches NOTHING. While a match is still on screen
 * the likely intent is to pick it, and two more inputs appearing under a list
 * they are about to click would push it away mid-reach.
 *
 * Typing in the leading field auto-translates into the other two; either can be
 * corrected by hand, which pins it. Picking a suggestion replaces all three at
 * once and clears any pin — the existing subcategory's own names then win.
 */
const SubplatformNameInput = ({ value, onChange, suggestions, onPickExisting, disabled }: Props) => {
  const { t, lang } = useLang();

  // Primary = the panel language. Among the rest English leads: the slug is
  // derived from it, so it is the identity.
  const others: Lang[] = (["en", "ru", "am"] as Lang[])
    .filter((l) => l !== lang)
    .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : 0));

  const [focused, setFocused] = useState<Lang | null>(null);

  const auto = useAutoTranslate({
    values: value,
    onChange,
    primary: lang,
    secondary: others,
    fieldClass: "subplatform_name",
    maxChars: 60,
  });

  const typed = (value[lang] ?? "").trim();
  const matches = matchSubplatforms(suggestions, typed);
  // Nothing matches what they typed → they are naming something new, so give
  // them the other two languages.
  const revealOthers = typed.length > 0 && matches.length === 0;

  const set = (l: Lang, v: string) =>
    l === lang ? auto.setPrimary(v) : auto.setSecondary(l, v);

  const field = (l: Lang, autoFocus = false) => {
    const forThis = matchSubplatforms(suggestions, value[l] ?? "");
    const showSuggestions = focused === l && forThis.length > 0;

    return (
      <div className="col" style={{ gap: 4 }}>
        <span className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {LANG_LABEL[l]}
          {l === "en" && lang !== "en" && (
            <span className="muted" style={{ fontSize: 10, fontWeight: 400 }}>· {t("platformName.enIdHint")}</span>
          )}
        </span>
        <Input
          placeholder={`${t("subplatform.name")} · ${LANG_LABEL[l]}`}
          value={value[l] ?? ""}
          onChange={(e) => set(l, e.target.value)}
          onFocus={() => setFocused(l)}
          onBlur={() => {
            setFocused((f) => (f === l ? null : f));
            if (l === lang) auto.flush();
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          disabled={disabled}
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
            <span className="muted" style={{ fontSize: 10, padding: "4px 8px 0" }}>
              {t("platformName.suggestions")}
            </span>
            {forThis.slice(0, 6).map((s) => (
              <button
                key={s.id}
                type="button"
                className="row-between"
                // mousedown before blur — keep focus so the click always fires.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  auto.adopt({ en: s.name_en ?? "", ru: s.name_ru ?? "", am: s.name_am ?? "" });
                  onPickExisting?.(s);
                }}
                style={{
                  textAlign: "left", background: "transparent", border: "none",
                  color: "inherit", cursor: "pointer", padding: "6px 8px",
                }}
              >
                <span>{platformPriceNameOf(s, lang)}</span>
                <span className="muted" style={{ fontSize: 11 }}>{s.name_en}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      {field(lang, true)}

      {/* The other locales reveal once it is clear nothing existing matches —
          a fade + slide per the desktop CSS standard, with max-height so the
          collapsed state takes no layout space. Kept mounted so typing in a
          secondary field never remounts or loses focus. */}
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

export default SubplatformNameInput;
