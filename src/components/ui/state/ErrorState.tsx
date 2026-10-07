import { ReactNode } from "react";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { useOnline } from "@/hooks/useOnline";
import StateView, { StateViewSize } from "./StateView";
import { classifyError, serverDetailOf } from "./viewState";

export interface ErrorStateProps {
  error: unknown;
  /** Re-run the failed read (`useAsync`'s `reload`). Omitted = no Retry. */
  onRetry?: () => void;
  size?: StateViewSize;
  /** Context-specific copy for a failed read ("Could not load branches"). */
  titleKey?: string;
  descriptionKey?: string | null;
  /** Context-specific copy for a 404 ("Booking not found"). */
  notFoundTitleKey?: string;
  notFoundDescriptionKey?: string | null;
  /** What a 404 offers instead of Retry — usually a way back. */
  notFoundAction?: ReactNode;
}

/**
 * A failed read, said properly: offline (no answer / the machine is offline),
 * not found (404) or failed (anything else) — each with its own pose and copy,
 * and Retry wired to the screen's reload. The server's sentence appears only as
 * a quiet second line for a failure we have no wording of our own for.
 */
const ErrorState = ({
  error, onRetry, size = "page", titleKey, descriptionKey,
  notFoundTitleKey, notFoundDescriptionKey, notFoundAction,
}: ErrorStateProps) => {
  const { t } = useLang();
  const online = useOnline();
  const kind = classifyError(error, online);
  const retry = onRetry ? (
    <Button type="button" variant="secondary" onClick={onRetry}>{t("action.retry")}</Button>
  ) : null;

  if (kind === "notFound") {
    return (
      <StateView
        variant="notFound"
        size={size}
        titleKey={notFoundTitleKey}
        descriptionKey={notFoundDescriptionKey}
        actions={notFoundAction}
      />
    );
  }
  if (kind === "offline") {
    return <StateView variant="offline" size={size} actions={retry} />;
  }
  return (
    <StateView
      variant="error"
      size={size}
      titleKey={titleKey}
      descriptionKey={descriptionKey}
      detail={serverDetailOf(error)}
      actions={retry}
    />
  );
};

export default ErrorState;
