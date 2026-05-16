import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import "@/types/desktopUpdates";
import type { DesktopUpdateState } from "@/types/desktopUpdates";
import { useEffect, useState } from "react";

/**
 * Non-closeable modal that owner / manager panels show as soon as
 * electron-updater finishes downloading a new release. Admin is
 * intentionally excluded — admin already drives the same install
 * action from `/settings/updates`, so the modal would just double up.
 *
 * Listens to the live `window.cyberplaceUpdates` push stream so it
 * reacts both to a fresh download that completed while the user was
 * sitting on a screen AND to one that completed before the component
 * mounted (the `getState()` seed handles the latter).
 *
 * Non-closeable means: no `onClose`, no backdrop dismiss, no ESC
 * handler, no close X. The only way forward is the restart button.
 */
const UpdateReadyModal = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [restarting, setRestarting] = useState(false);

  // Owner + manager only. Admin uses /settings/updates instead.
  const shouldWatch =
    !!user && (user.role === "company_owner" || user.role === "manager");

  useEffect(() => {
    if (!shouldWatch) return;
    if (typeof window === "undefined" || !window.cyberplaceUpdates) return;
    let mounted = true;

    // Seed: maybe the download finished while we were on another screen.
    window.cyberplaceUpdates
      .getState()
      .then((s) => { if (mounted && s) setState(s); })
      .catch(() => { /* bridge gone — main process logs the error */ });

    const unsub = window.cyberplaceUpdates.onState((s) => {
      if (mounted) setState(s);
    });

    return () => { mounted = false; unsub?.(); };
  }, [shouldWatch]);

  if (!shouldWatch) return null;
  if (state?.status !== "downloaded") return null;

  const version = state.availableVersion ?? "?";

  const onRestart = () => {
    if (restarting) return;
    setRestarting(true);
    // No await — main process calls quitAndInstall(), the app dies
    // immediately. We flip the flag just to disable the button so
    // an accidental double-click doesn't fire two install calls.
    void window.cyberplaceUpdates?.install();
  };

  return (
    <Modal open closeOnBackdrop={false}>
      <div
        className="gradient-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cp-update-ready-title"
        style={{ width: "min(440px, 100%)" }}
      >
        <div
          className="gradient-card-inner"
          style={{ textAlign: "center", padding: 28 }}
        >
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>
            {/* Party emoji — matches the release/announcement tone the
                user asked for. */}
            🎉
          </div>
          <h2
            id="cp-update-ready-title"
            style={{ margin: "0 0 10px", fontSize: 20 }}
          >
            {t("updates.readyModalTitle")}
          </h2>
          <p className="muted" style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
            {fmt(t("updates.readyModalBody"), version)}
          </p>
          <Button
            type="button"
            onClick={onRestart}
            disabled={restarting}
            style={{ minWidth: 220 }}
          >
            {t("updates.readyModalRestart")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateReadyModal;
