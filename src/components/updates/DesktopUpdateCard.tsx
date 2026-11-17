import { apiGetManifest } from "@/api/updates";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import "@/types/desktopUpdates";
import type { DesktopUpdateState } from "@/types/desktopUpdates";
import { notify } from "@/ui/notify";
import { useEffect, useState } from "react";

/** The newest of two dotted versions; equal when the same. */
const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** How long a «Проверить» waits for the updater to settle on an answer. */
const SETTLE_MS = 20_000;

/**
 * «Обновление приложения» for every role (2026-11-17, owner): the version this
 * desktop runs, a «Проверить обновления» that answers in a popup — up to date,
 * or a new version found and coming down — and, once it is here, one big
 * «Установить и перезапустить».
 *
 * Nothing here decides which version: the SERVER's approved one
 * (`/updates/panel/manifest`) is what the updater fetches
 * (`checkGated`), exactly as the background catch-up does. Installing restarts
 * the app only — running seats, settings and sign-in survive, as every update
 * always has.
 *
 * In a browser (the owner web) there is no installer: the page is always the
 * newest, and the card says so instead of offering a button that cannot work.
 */
const DesktopUpdateCard = () => {
  const { t } = useLang();
  const ask = useConfirm();
  const bridge = typeof window !== "undefined" ? window.cyberplaceUpdates : undefined;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.getState().then((s) => { if (alive && s) setState(s); }).catch(() => { /* main process logs it */ });
    const off = bridge.onState((s) => { if (alive) setState(s); });
    return () => { alive = false; off?.(); };
  }, [bridge]);

  if (!bridge) {
    return (
      <section className="col desktop-update" data-testid="desktop-update-card">
        <strong className="desktop-update__title">{t("ownUpdates.appTitle")}</strong>
        <span className="muted">{t("ownUpdates.webAlwaysLatest")}</span>
      </section>
    );
  }

  const current = state?.currentVersion ?? "";
  const ready = state?.status === "downloaded";
  const downloading = state?.status === "downloading" || state?.status === "available";

  /** Ask the updater for the approved version, then wait for it to say where it stands. */
  const check = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const manifest = await apiGetManifest("panel");
      const approved = manifest?.version ?? null;
      if (approved === null || (current !== "" && compareVersions(approved, current) <= 0)) {
        notify.message("success", fmt(t("ownUpdates.upToDate"), current));
        return;
      }
      let latest = await bridge.checkGated(approved);
      const until = Date.now() + SETTLE_MS;
      while (latest && (latest.status === "checking" || latest.status === "idle") && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 500));
        latest = await bridge.getState();
      }
      if (latest?.status === "downloaded") {
        notify.message("success", fmt(t("ownUpdates.readyToast"), latest.availableVersion ?? approved));
      } else if (latest?.status === "error") {
        notify.message("error", t("ownUpdates.checkFailed"));
      } else {
        notify.message("success", fmt(t("ownUpdates.foundToast"), approved));
      }
    } catch {
      notify.message("error", t("ownUpdates.checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    if (installing || !ready) return;
    if (!(await ask(t("ownUpdates.installConfirm")))) return;
    setInstalling(true);
    void bridge.install();
  };

  return (
    <section className="col desktop-update" data-testid="desktop-update-card">
      <strong className="desktop-update__title">{t("ownUpdates.appTitle")}</strong>
      <span className="muted" data-testid="desktop-update-version">{fmt(t("ownUpdates.current"), current || "-")}</span>
      {ready && (
        <span className="desktop-update__ready" data-testid="desktop-update-ready">
          {fmt(t("ownUpdates.readyLine"), state?.availableVersion ?? "")}
        </span>
      )}
      {downloading && (
        <span className="muted" data-testid="desktop-update-downloading">
          {fmt(t("ownUpdates.downloading"), state?.availableVersion ?? "", state?.progressPercent ?? 0)}
        </span>
      )}
      <div className="row desktop-update__actions">
        {ready && (
          <Button onClick={() => void install()} disabled={installing} className="desktop-update__install" data-testid="desktop-update-install">
            {installing ? "…" : t("ownUpdates.install")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => void check()} disabled={checking || installing} data-testid="desktop-update-check">
          {checking ? t("ownUpdates.checking") : t("ownUpdates.check")}
        </Button>
      </div>
    </section>
  );
};

export default DesktopUpdateCard;
