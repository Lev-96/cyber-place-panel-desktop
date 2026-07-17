import { app, BrowserWindow } from "electron";
import log from "electron-log";
import { autoUpdater, type UpdateInfo, type ProgressInfo } from "electron-updater";

/**
 * Snapshot of the auto-update state machine, mirrored to the renderer
 * over IPC so the admin UI can render a live "checking… → available →
 * downloading 42% → ready" widget without keeping its own copy of the
 * truth. Every transition flows through {@link UpdateService.update},
 * so the renderer can trust that any state it sees is canonical.
 */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  progressPercent: number | null;
  notes: string | null;
  error: string | null;
}

/**
 * Wraps `electron-updater`'s singleton `autoUpdater` so the rest of the
 * app can interact with the update lifecycle through a small, typed
 * surface (`check`, `installAndRestart`, `getState`, `onState`).
 *
 * Design notes:
 *   - `autoDownload = false` — nothing is ever fetched automatically. A
 *     download starts only from {@link UpdateService.checkGated} once it
 *     confirms the version on the GitHub channel equals the version an
 *     admin has PROMOTED on the backend. This is what keeps owner/manager
 *     panels from self-updating ahead of admin approval.
 *   - `autoInstallOnAppQuit = false` — an un-promoted version must never
 *     slip in on a quit either; installs happen only via the explicit
 *     `installAndRestart` after a gated download completed.
 *   - Events are broadcast to ALL renderer windows (`updates:state`
 *     IPC channel) rather than pinned to one, so a future settings
 *     window doesn't go stale relative to the main window.
 *   - Errors never throw — they collapse into the `error` status with
 *     the message string, so the renderer's render-side code never
 *     has to wrap state reads in try/catch.
 *
 * SRP: this class owns the autoUpdater lifecycle, nothing else. The
 * decision of WHEN to call `check()` lives in the main process glue
 * code and the renderer UI; the decision of WHERE to download from
 * lives in `electron-builder.json` publish config. That separation
 * makes each piece testable in isolation.
 */
export class UpdateService {
  private state: UpdateState;
  private listeners = new Set<(state: UpdateState) => void>();
  /**
   * The admin-promoted version the current check is allowed to download,
   * or null for a plain (non-downloading) check. Set by {@link checkGated};
   * consulted in the `update-available` handler. Null means "download
   * nothing", which is the safe default.
   */
  private gateVersion: string | null = null;

  constructor(private readonly logTag: string = "panel") {
    this.state = {
      status: "idle",
      currentVersion: app.getVersion(),
      availableVersion: null,
      progressPercent: null,
      notes: null,
      error: null,
    };
    this.configure();
    this.bindAutoUpdaterEvents();
  }

  /**
   * Trigger a check against the configured GitHub Releases feed. Safe
   * to call repeatedly — autoUpdater de-duplicates concurrent checks
   * internally. Awaiting is optional; the result is mirrored through
   * `onState` so callers don't need the return value.
   */
  async check(): Promise<UpdateState> {
    // A plain check never downloads — clear any gate so a stale promoted
    // version from a previous gated check can't leak a download here.
    this.gateVersion = null;
    if (this.state.status === "checking" || this.state.status === "downloading") {
      // Re-emit current state so caller sees "already busy" without a
      // duplicate network call. Cheap and avoids racing checkForUpdates.
      return this.getState();
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e: unknown) {
      this.handleError(e);
    }
    return this.getState();
  }

  /**
   * Gated check for the admin-driven rollout. `promotedVersion` is the
   * version the backend pointer currently approves — delivered by the
   * `app-update.promoted` Reverb broadcast or read from
   * `/updates/panel/manifest` on boot for catch-up. We only download when
   * the version electron-updater finds on the GitHub channel is EXACTLY
   * this promoted version, so a newer-but-unpromoted release never
   * installs itself on an owner/manager panel ahead of admin approval.
   *
   * A null/empty `promotedVersion` means "nothing approved yet" → no-op.
   */
  async checkGated(promotedVersion: string | null): Promise<UpdateState> {
    this.gateVersion = promotedVersion && promotedVersion.length > 0 ? promotedVersion : null;
    if (!this.gateVersion) {
      this.update({ status: "idle", availableVersion: null, progressPercent: null, error: null });
      return this.getState();
    }
    if (this.state.status === "checking" || this.state.status === "downloading") {
      return this.getState();
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e: unknown) {
      this.handleError(e);
    }
    return this.getState();
  }

  /**
   * Install the previously downloaded update and restart the app.
   * No-op when the state is anything other than `downloaded` — protects
   * against an admin double-clicking the button during the download.
   *
   * `isSilent=true, forceRunAfter=true` — pass `/S` to NSIS so the
   * installer wizard never appears on update; the new version starts
   * automatically after the swap. Pairs with `nsis.oneClick: true` in
   * electron-builder.json. Without isSilent the user sees a full
   * NSIS wizard ("Welcome", path, components…) which defeats the
   * point of an in-app "Restart" button.
   */
  installAndRestart(): void {
    if (this.state.status !== "downloaded") {
      log.warn(`[${this.logTag}] installAndRestart called in status=${this.state.status}; ignoring`);
      return;
    }
    log.info(`[${this.logTag}] quitAndInstall → restarting into v${this.state.availableVersion}`);
    autoUpdater.quitAndInstall(true, true);
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  /**
   * Subscribe to every state transition. Returns the unsubscribe
   * function so callers can clean up on window close. Listeners are
   * invoked synchronously after the internal state is committed, so a
   * listener observing `state.status === "downloaded"` can safely call
   * `installAndRestart()` from inside the callback.
   */
  onState(fn: (state: UpdateState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private configure(): void {
    // Hard-gated rollout: NEVER auto-download and NEVER auto-install on
    // quit. Bytes move only when checkGated() confirms the channel version
    // equals the admin-promoted version (see the update-available handler),
    // and installs happen only via the explicit installAndRestart().
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = log;
    // electron-log defaults to silent in production; lift it so update
    // events show up in the user-data log file ("update.log" is the
    // convention electron-updater uses with electron-log as logger).
    log.transports.file.level = "info";
  }

  private bindAutoUpdaterEvents(): void {
    autoUpdater.on("checking-for-update", () => {
      this.update({ status: "checking", error: null });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.update({
        status: "available",
        availableVersion: info.version,
        notes: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
        progressPercent: 0,
      });
      // Hard gate: fetch the bytes ONLY when the channel version is exactly
      // the admin-promoted one. Otherwise hold — an owner/manager panel
      // never self-updates ahead of approval, and a newer-but-unpromoted
      // GitHub release waits until the admin promotes it too.
      if (this.gateVersion && info.version === this.gateVersion) {
        log.info(`[${this.logTag}] promoted v${info.version} matches channel; downloading`);
        autoUpdater.downloadUpdate().catch((e: unknown) => this.handleError(e));
      } else {
        log.info(`[${this.logTag}] v${info.version} available but not promoted (gate=${this.gateVersion ?? "none"}); holding`);
      }
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.update({
        status: "not-available",
        availableVersion: info.version,
        progressPercent: null,
      });
    });

    autoUpdater.on("download-progress", (info: ProgressInfo) => {
      this.update({
        status: "downloading",
        progressPercent: Math.round(info.percent),
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.update({
        status: "downloaded",
        availableVersion: info.version,
        progressPercent: 100,
      });
    });

    autoUpdater.on("error", (err: Error) => {
      this.handleError(err);
    });
  }

  private update(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch };
    log.info(`[${this.logTag}] update state →`, this.state);
    // Fan out to in-process listeners first (e.g. the IPC bridge that
    // pushes to renderer windows), then to any extra subscribers.
    for (const fn of this.listeners) {
      try { fn(this.state); } catch (e) { log.error("UpdateService listener threw", e); }
    }
  }

  private handleError(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e);
    log.error(`[${this.logTag}] update error:`, message);
    this.update({ status: "error", error: message });
  }
}

/**
 * Broadcast the given state to every BrowserWindow's webContents. Kept
 * outside the class so the test environment can wire a different
 * transport (e.g. a mock that records calls) without monkey-patching.
 */
export const broadcastUpdateState = (state: UpdateState): void => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send("updates:state", state);
    }
  }
};
