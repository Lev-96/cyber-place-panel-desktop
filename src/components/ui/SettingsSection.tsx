import { ReactNode } from "react";
import Button from "@/components/ui/Button";
import { SkeletonForm } from "@/components/ui/Skeleton";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  title: ReactNode;
  /** One sentence under the title: what this setting is for. */
  description?: ReactNode;
  /** Controls in the header, opposite the title (e.g. "+ New"). */
  actions?: ReactNode;
  /** While the data this section edits is loading: a skeleton, no form. */
  loading?: boolean;
  /**
   * The load failed: say so and offer a retry — and render NO form. A form
   * drawn from placeholder values would save those placeholders over the
   * real ones.
   */
  error?: Error | null;
  onRetry?: () => void;
  /** How many skeleton rows to draw while loading. */
  skeletonFields?: number;
  children?: ReactNode;
}

/**
 * One settings block on a settings page: a card with a title, an optional
 * description and header actions, and the three states every such block has
 * (loading, failed, ready). Pure presentation — it never loads or saves.
 *
 * Reusable on any settings screen; the Branch → Prices page is its first user.
 */
const SettingsSection = ({
  title, description, actions, loading = false, error = null, onRetry, skeletonFields = 3, children,
}: Props) => {
  const { t } = useLang();

  return (
    <section className="card settings-section">
      <header className="settings-section__head">
        <div className="settings-section__titles">
          <h3 className="settings-section__title">{title}</h3>
          {description && <p className="settings-section__desc">{description}</p>}
        </div>
        {actions && <div className="settings-section__actions">{actions}</div>}
      </header>
      {error ? (
        <div className="settings-section__error" role="alert">
          <span className="error">{error.message}</span>
          {onRetry && (
            <Button variant="secondary" type="button" onClick={onRetry}>{t("action.retry")}</Button>
          )}
        </div>
      ) : loading ? (
        <SkeletonForm fields={skeletonFields} />
      ) : (
        children
      )}
    </section>
  );
};

export default SettingsSection;
