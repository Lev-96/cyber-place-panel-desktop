import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES, Lang } from "@/i18n/translations";
import { I18nMap, TranslationStatus, needsAttention, pickLocale } from "@/i18n/translated";
import Input from "@/components/ui/Input";
import { CSSProperties } from "react";

/**
 * The two pieces of UI the auto-translation pipeline needs on a form.
 *
 * Staff type a value ONCE. These components make the two things that were
 * previously invisible explicit: which language they are typing in, and what
 * happened to the automatic translations afterwards. Without the second one a
 * failed translation is silent, and staff discover it from a customer.
 */

/** Colour per state — muted for "working on it", red only for "a human is needed". */
const STATUS_COLOR: Record<TranslationStatus, string> = {
  ready: "#22c55e",
  skipped: "#64748b",
  pending: "#f59e0b",
  stale: "#f59e0b",
  failed: "#ef4444",
  needs_review: "#ef4444",
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flex: "0 0 auto",
};

interface BadgeProps {
  status: TranslationStatus | undefined;
  /** Hide the badge entirely while everything is fine (list views). */
  quietWhenReady?: boolean;
}

/**
 * Compact per-field translation state.
 *
 * `ready` and `skipped` render nothing in quiet mode: a green dot on every row
 * of a 200-product list is noise, and noise is how staff learn to ignore an
 * indicator that later actually matters.
 */
export const TranslationBadge = ({ status, quietWhenReady = true }: BadgeProps) => {
  const { t } = useLang();

  if (!status) return null;
  if (quietWhenReady && (status === "ready" || status === "skipped")) return null;

  return (
    <span
      className="row"
      style={{ gap: 6, alignItems: "center", fontSize: 11, color: "#9aa4bf" }}
      title={t(`i18n.status.${status}.hint`)}
    >
      <span style={{ ...dot, background: STATUS_COLOR[status] }} />
      <span style={{ color: needsAttention(status) ? STATUS_COLOR[status] : undefined }}>
        {t(`i18n.status.${status}`)}
      </span>
    </span>
  );
};

interface SelectProps {
  value: Lang;
  onChange: (lang: Lang) => void;
  disabled?: boolean;
}

/**
 * "I am typing in …" selector.
 *
 * Defaults to the panel's UI language, which is right almost every time — the
 * selector exists for the manager who runs the panel in English but writes
 * product names in Russian. Getting this wrong is not destructive: correcting
 * it re-runs the translations from the new source language.
 */
export const SourceLocaleSelect = ({ value, onChange, disabled }: SelectProps) => {
  const { t } = useLang();

  return (
    <label className="col" style={{ gap: 6 }}>
      <span className="muted" style={{ fontSize: 12 }}>{t("i18n.sourceLocale")}</span>
      <select
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
      <span className="muted" style={{ fontSize: 11 }}>{t("i18n.sourceLocale.hint")}</span>
    </label>
  );
};

interface PreviewProps {
  i18n: I18nMap | null | undefined;
  field: string;
  /** Locale the value was authored in — shown as "original", not as a translation. */
  sourceLocale: Lang;
  status?: TranslationStatus;
  /** Called when staff override one locale by hand. Omit to render read-only. */
  onEdit?: (locale: Lang, value: string) => void;
}

/**
 * Read-out of the machine translations for one field, with optional hand-editing.
 *
 * Editing a locale here is a deliberate override: the backend marks that cell
 * `is_manual` and will never overwrite it again — it only flags it for review
 * when the source text changes. That is why the hint says "overrides", not
 * "edits".
 */
export const TranslationPreview = ({ i18n, field, sourceLocale, status, onEdit }: PreviewProps) => {
  const { t } = useLang();
  const bag = i18n?.[field];

  // Nothing to show before the first save — the entity does not exist yet.
  if (!bag) return null;

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row-between" style={{ alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("i18n.translations")}</span>
        <TranslationBadge status={status} quietWhenReady={false} />
      </div>

      {LANGUAGES.filter((l) => l.code !== sourceLocale).map((l) => {
        const value = bag[l.code] ?? "";

        return onEdit ? (
          <Input
            key={l.code}
            label={l.name}
            value={value}
            placeholder={t("i18n.pending")}
            onChange={(e) => onEdit(l.code, e.target.value)}
          />
        ) : (
          <div key={l.code} className="row-between" style={{ gap: 10, fontSize: 13 }}>
            <span className="muted">{l.name}</span>
            <span>{value || <em className="muted">{t("i18n.pending")}</em>}</span>
          </div>
        );
      })}

      {onEdit && <span className="muted" style={{ fontSize: 11 }}>{t("i18n.overrideHint")}</span>}
    </div>
  );
};

/**
 * Convenience for list rows: the label in the active language, with the badge
 * appended only when the field needs a human.
 */
export const TranslatedLabel = ({
  i18n,
  field,
  fallback,
  status,
}: {
  i18n: I18nMap | null | undefined;
  field: string;
  fallback: string;
  status?: TranslationStatus;
}) => {
  const { lang } = useLang();
  const value = pickLocale(i18n?.[field], lang) ?? fallback;

  return (
    <span className="row" style={{ gap: 8, alignItems: "center" }}>
      <span>{value}</span>
      {needsAttention(status) && <TranslationBadge status={status} />}
    </span>
  );
};
