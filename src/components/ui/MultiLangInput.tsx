import FlagIcon from "@/components/ui/FlagIcon";
import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES, Lang } from "@/i18n/translations";
import { I18nMap } from "@/i18n/translated";
import { LangValues, useAutoTranslate } from "@/i18n/useAutoTranslate";
import { useMemo } from "react";

export type { LangValues };

export const emptyLangValues = (): LangValues =>
  LANGUAGES.reduce((acc, l) => ({ ...acc, [l.code]: "" }), {} as LangValues);

/** Build a value from a plain per-locale map (legacy `name_en/ru/am` columns). */
export const langValuesFrom = (
  source: Partial<Record<Lang, string | null | undefined>> | null | undefined,
): LangValues =>
  LANGUAGES.reduce(
    (acc, l) => ({ ...acc, [l.code]: source?.[l.code] ?? "" }),
    emptyLangValues(),
  );

/** True when at least one language carries text. */
export const hasAnyValue = (values: LangValues): boolean =>
  LANGUAGES.some((l) => (values[l.code] ?? "").trim() !== "");

/** Languages ordered with the interface language first, then the canonical rest. */
export const orderedLocales = (lang: Lang): Lang[] => [
  lang,
  ...LANGUAGES.map((l) => l.code).filter((c) => c !== lang),
];

/** First non-empty value, interface-language first — for legacy single-string columns. */
export const primaryValue = (values: LangValues, lang: Lang): string => {
  for (const code of orderedLocales(lang)) {
    const v = (values[code] ?? "").trim();
    if (v) return v;
  }
  return "";
};

/**
 * Seed the editor for one field of an auto-translated entity.
 *
 * Falls back to the raw column under the CURRENT interface language when the
 * entity has no `i18n` yet — a row created before the pipeline, or one saved a
 * second ago. Without this the form would open blank on a record that plainly
 * has a name, and saving would then wipe it.
 */
export const langValuesFromField = (
  i18n: I18nMap | null | undefined,
  field: string,
  raw: string | null | undefined,
  lang: Lang,
): LangValues => {
  const values = langValuesFrom(i18n?.[field] as Partial<Record<Lang, string | null>> | undefined);

  if (!hasAnyValue(values) && typeof raw === "string" && raw.trim() !== "") {
    values[lang] = raw;
  }

  return values;
};

interface Props {
  label: string;
  values: LangValues;
  onChange: (values: LangValues) => void;
  /** Groups identical strings in the translation memory; selects the provider. */
  fieldClass?: string;
  maxChars?: number;
  /** Renders textareas instead of inputs — for descriptions. */
  multiline?: boolean;
  /** Only the first (interface-language) box is required; the rest are filled for you. */
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * One field, three languages.
 *
 * The interface language always comes FIRST — that is the box the user actually
 * types in, and putting a language they may not read at the top would make them
 * hunt for their own. The other two follow in the app's canonical order, so the
 * layout is stable rather than reshuffling as they type.
 *
 * Typing in the first box translates into the other two automatically; any box
 * can then be edited by hand. The debounce, race guard and per-language locks
 * live in {@link useAutoTranslate}, shared with the platform-name field.
 *
 * Every language is stored independently — this component never derives one
 * from another at save time.
 */
const MultiLangInput = ({
  label,
  values,
  onChange,
  fieldClass = "default",
  maxChars = 255,
  multiline = false,
  required = false,
  autoFocus = false,
  disabled = false,
}: Props) => {
  const { lang, t } = useLang();

  const ordered = useMemo(() => orderedLocales(lang), [lang]);
  const [primary, ...secondary] = ordered;

  const { busy, failed, reason, retryAfter, locked, setPrimary, setSecondary, releaseLock, flush } = useAutoTranslate({
    values,
    onChange,
    primary,
    secondary,
    fieldClass,
    maxChars,
  });

  const nameOf = (code: Lang) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

  const field = (code: Lang, isPrimary: boolean) => {
    const common = {
      className: "input",
      value: values[code] ?? "",
      maxLength: maxChars,
      disabled,
      placeholder: isPrimary ? undefined : t("multilang.autoPlaceholder"),
      onChange: (e: { target: { value: string } }) =>
        isPrimary ? setPrimary(e.target.value) : setSecondary(code, e.target.value),
      // Leaving the source box translates at once. That is what lets the idle
      // debounce be long enough not to fire mid-sentence: the wait only ever
      // applies to someone who is still typing.
      onBlur: isPrimary ? flush : undefined,
    };

    return (
      <div key={code} className="cp-mli-row">
        <div className="cp-mli-lang">
          <FlagIcon lang={code} size={22} />
          <span>{nameOf(code)}</span>
        </div>

        {multiline
          ? <textarea {...common} rows={isPrimary ? 3 : 2} autoFocus={isPrimary && autoFocus} required={isPrimary && required} />
          : <input {...common} autoFocus={isPrimary && autoFocus} required={isPrimary && required} />}

        <div className="cp-mli-note">
          {isPrimary && busy && <span className="cp-mli-busy">{t("multilang.translating")}</span>}
          {!isPrimary && locked[code] && (
            <button type="button" className="cp-mli-reset" onClick={() => releaseLock(code)} disabled={disabled}>
              {t("multilang.edited")} · {t("multilang.reset")}
            </button>
          )}
          {!isPrimary && !locked[code] && failed.includes(code) && (
            <span className="cp-mli-failed">{t("multilang.failed")}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="col cp-mli" style={{ gap: 8 }}>
      <span className="label">{label}</span>
      {field(primary, true)}
      {secondary.map((code) => field(code, false))}

      {/* One line for the whole field rather than a repeat under each language:
          a configuration problem is not per-language, and saying it three times
          reads as three problems. */}
      {reason && (
        <span className="cp-mli-failed" style={{ fontSize: 11 }}>
          {/* A rate limit that clears itself in seconds must not read like an
              outage — otherwise people start filling three boxes by hand over
              a wait shorter than doing so. */}
          {retryAfter !== null
            ? `${t("multilang.reason.quota_retry")} ${retryAfter} ${t("multilang.seconds")}`
            : t(`multilang.reason.${reason}`)}
        </span>
      )}
    </div>
  );
};

export default MultiLangInput;
