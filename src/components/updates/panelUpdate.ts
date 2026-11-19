import type { IDbNotification } from "@/api/notifications";
import { fmt } from "@/i18n/translations";

/**
 * "A new desktop version is out" — the server's notification
 * (`App\Notifications\PanelUpdateAvailable`, 2026-11-17), as every screen that
 * shows it reads it: the bell's row and the corner card.
 *
 * The row's `type` column is an English sentence on purpose (it is what panels
 * older than this notice show); everything here is built from `data` instead,
 * in the panel's own language.
 */
export const PANEL_UPDATE_TYPE = "app_update.available";

/** `PanelUpdateAvailable::toArray()`. */
export interface PanelUpdateNotice {
  id: string;
  app: string;
  version: string;
  mandatory: boolean;
}

/**
 * The newest of two dotted versions; 0 when the same. A staging build's
 * "1.0.63-staging.2" reads as 1.0.63.2, so staging.1 < staging.2 (moved here
 * unchanged from `DesktopUpdateCard`).
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** Where a person installs the desktop's update: the admin's release screen, everyone else's «Обновление». */
export const updatesRouteFor = (role: string | undefined): string =>
  role === "admin" ? "/settings/updates" : "/settings/agent-updates";

/** The row as a panel-update notice, or null when it is something else. */
export const asPanelUpdate = (n: IDbNotification): PanelUpdateNotice | null => {
  if (n.data?.type !== PANEL_UPDATE_TYPE) return null;
  const version = typeof n.data.version === "string" ? n.data.version.trim() : "";
  if (version === "") return null;
  // `app` has always been "panel" (the sender skips anything else); a row
  // without it is read as the panel's.
  const app = typeof n.data.app === "string" && n.data.app !== "" ? n.data.app : "panel";
  return { id: n.id, app, version, mandatory: n.data.mandatory === true };
};

/**
 * The one notice to show now: unread, not put off, for the panel, and newer
 * than the version this desktop runs (a row for the version already installed
 * has nothing left to ask). Several versions announced while nobody looked
 * read as one — the newest. `installed` null = not known yet: shown.
 */
export const pendingPanelUpdate = (
  list: readonly IDbNotification[],
  putOff: ReadonlySet<string>,
  installed: string | null,
): PanelUpdateNotice | null => {
  let best: PanelUpdateNotice | null = null;
  for (const n of list) {
    if (n.read_at !== null || putOff.has(n.id)) continue;
    const notice = asPanelUpdate(n);
    if (!notice || notice.app !== "panel") continue;
    if (installed && compareVersions(notice.version, installed) <= 0) continue;
    if (!best || compareVersions(notice.version, best.version) > 0) best = notice;
  }
  return best;
};

/**
 * The words, said the same in the bell and in the card: «Новая версия Cyber
 * Place 1.0.68» / «Откройте раздел «Обновление» и нажмите «Проверить
 * обновления».». The section and the button are named by their own keys, so
 * the sentence always matches what the screen says.
 */
export const panelUpdateText = (version: string, t: (key: string) => string): { title: string; body: string } => ({
  title: fmt(t("panelUpdate.title"), version),
  body: fmt(t("panelUpdate.body"), t("nav.agentUpdates"), t("ownUpdates.check")),
});
