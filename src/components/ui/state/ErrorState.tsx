import { ReactNode, useContext } from "react";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { useOnline } from "@/hooks/useOnline";
import StateView, { StateViewSize } from "./StateView";
import { BranchScopeContext } from "./branchScope";
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
  /** What a 404 (or a 403 «no access») offers instead of Retry — usually a way back. */
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
  const inBranch = useContext(BranchScopeContext);
  // «No access to this branch» only where the screen IS one branch's.
  const classified = classifyError(error, online);
  const kind = classified === "forbidden" && !inBranch ? "error" : classified;
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
  if (kind === "forbidden") {
    // The server answered "not yours": retrying asks the same question, and
    // its English sentence is not for the cashier (B11). The screen's own
    // "could not load" title would be wrong too: nothing failed.
    return (
      <StateView
        variant="notFound"
        size={size}
        className="cp-state--forbidden"
        titleKey="state.forbidden.title"
        descriptionKey="state.forbidden.description"
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
