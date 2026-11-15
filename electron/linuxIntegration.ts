import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import log from "electron-log";

/**
 * First-run Linux desktop integration. AppImage by itself is just an
 * executable — it doesn't register itself with the freedesktop.org
 * specs (no menu entry, no icon, no MIME associations) the way a .deb
 * would. AppImageLauncher solves this but partners would have to
 * install it separately AND it isn't packaged on every distro
 * (Kali, RHEL, Fedora, Arch all have different stories).
 *
 * This module replicates the bare minimum AppImageLauncher does — a
 * `.desktop` file in `~/.local/share/applications/` pointing at the
 * AppImage's current path, plus the icon copied into
 * `~/.local/share/icons/hicolor/512x512/apps/`. Both locations are
 * per-user and need no `sudo`; works on every desktop environment
 * that follows the freedesktop spec (GNOME, KDE, XFCE, Cinnamon, …).
 *
 * Re-run on every launch is intentionally cheap: it rewrites the
 * `.desktop` file every time, which keeps the `Exec=` path pointing
 * at wherever the AppImage currently lives even if the user moved it.
 * No-op on non-Linux and when not running as an AppImage.
 */

/**
 * File name (without `.desktop`) of the entry written below. package.json
 * `desktopName` must be `${LINUX_DESKTOP_ID}.desktop` (pinned by
 * src/linuxIntegration.test.ts): Electron reads it at startup
 * (`app.setDesktopName`, else `${app.name}.desktop`, a file that does not
 * exist) and Wayland compositors take the window's app_id from it.
 */
export const LINUX_DESKTOP_ID = "cyberplace-panel";

interface IntegrationConfig {
  /** App's stable kebab-case identifier — used in file names. */
  appId: string;
  /** User-facing name shown in the application menu. */
  displayName: string;
  /** Short tooltip / sub-label shown by GNOME / KDE. */
  comment: string;
  /** Path to the icon source PNG (typically the bundled icon.png). */
  iconSourcePath: string;
  /**
   * The X11 WM_CLASS of our windows — pass `app.getName()`. Electron sets
   * WM_CLASS to (lowercase(name), name) from the app name, i.e. package.json
   * `productName ?? name` = "cyber-place-panel-desktop". The desktop
   * environment matches a running window to its menu entry by
   * `StartupWMClass`; until 2026-11-15 this was the display name
   * ("Cyberplace Panel"), so KDE/GNOME never matched and the taskbar showed
   * a generic icon.
   */
  wmClass: string;
}

/** The `.desktop` file body. Pure, so the contract is unit-tested. */
export const desktopEntryBody = (config: IntegrationConfig, appImagePath: string): string =>
  [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${config.displayName}`,
    `Comment=${config.comment}`,
    `Exec="${appImagePath}" %U`,
    `Icon=${config.appId}`,
    "Terminal=false",
    "Categories=Utility;Office;",
    "StartupNotify=true",
    `StartupWMClass=${config.wmClass}`,
    "",
  ].join("\n");

/**
 * The `icon` option for a BrowserWindow. Linux only: there the window's own
 * `_NET_WM_ICON` is what the taskbar and title bar draw, and Electron sets it
 * only from this option. Windows takes the icon from the exe's resources, so
 * nothing changes there. A missing file (an unpackaged run) yields no option
 * rather than an error.
 */
export const windowIconOptions = (
  platform: NodeJS.Platform,
  iconPath: string,
  fileExists: (path: string) => boolean = existsSync,
): { icon?: string } => (platform === "linux" && fileExists(iconPath) ? { icon: iconPath } : {});

const isAppImage = (): boolean => !!process.env.APPIMAGE;

/**
 * Idempotently register the running AppImage with the user's desktop
 * environment. Safe to call on every launch; returns silently on
 * non-Linux platforms.
 */
export const ensureLinuxDesktopIntegration = (config: IntegrationConfig): void => {
  if (process.platform !== "linux") return;
  if (!isAppImage()) {
    // Running unpacked (electron:dev) or under another packager —
    // nothing to register because there's no portable binary path.
    log.info("[linux-integration] not an AppImage launch, skipping");
    return;
  }

  const appImagePath = process.env.APPIMAGE;
  if (!appImagePath || !existsSync(appImagePath)) {
    log.warn("[linux-integration] APPIMAGE env points at missing file", { appImagePath });
    return;
  }

  try {
    const home = homedir();
    const appsDir = join(home, ".local", "share", "applications");
    const iconsDir = join(home, ".local", "share", "icons", "hicolor", "512x512", "apps");
    mkdirSync(appsDir, { recursive: true });
    mkdirSync(iconsDir, { recursive: true });

    // Copy icon if missing or if the source has changed (size).
    const iconTarget = join(iconsDir, `${config.appId}.png`);
    if (existsSync(config.iconSourcePath)) {
      copyFileSync(config.iconSourcePath, iconTarget);
    } else {
      log.warn("[linux-integration] icon source missing", { iconSourcePath: config.iconSourcePath });
    }

    // .desktop file — written every launch so Exec= follows the
    // AppImage if the user moved it. Spec: https://specifications.freedesktop.org/desktop-entry-spec/
    const desktopPath = join(appsDir, `${config.appId}.desktop`);
    writeFileSync(desktopPath, desktopEntryBody(config, appImagePath), { mode: 0o644 });

    log.info("[linux-integration] registered", { desktopPath, iconTarget, appImagePath });
  } catch (e) {
    // Integration is a nice-to-have, never block app startup.
    log.error("[linux-integration] failed", e);
  }
};

/**
 * Resolves the bundled icon path. In packaged builds the asar wraps
 * everything; we ship the icon via `extraResources` so it's
 * accessible by an absolute filesystem path here.
 */
export const bundledIconPath = (): string => {
  // resourcesPath points at <install>/resources/ in packaged builds.
  // In dev (`electron:dev`) it points at electron's own resources;
  // the icon lookup will fail there and the integration will skip.
  return resolve(process.resourcesPath, "build", "icon.png");
};
