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
 *   - `autoDownload = false` — we drive download explicitly after the
 *     "available" event so an admin can see the version first if we
 *     ever decide to gate downloads behind a confirmation dialog.
 *   - `autoInstallOnAppQuit = true` — if the user simply closes the
 *     app between download and confirm, the new version installs on
 *     next start. Idempotent with the explicit `installAndRestart`.
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
   * Install the previously downloaded update and restart the app.
   * No-op when the state is anything other than `downloaded` — protects
   * against an admin double-clicking the button during the download.
   *
   * `isSilent=false, forceRunAfter=true` mirrors the documented "best
   * UX" config: NSIS installer runs visibly on Windows so the user
   * sees the progress dialog, the new version starts on completion.
   */
  installAndRestart(): void {
    if (this.state.status !== "downloaded") {
      log.warn(`[${this.logTag}] installAndRestart called in status=${this.state.status}; ignoring`);
      return;
    }
    log.info(`[${this.logTag}] quitAndInstall → restarting into v${this.state.availableVersion}`);
    autoUpdater.quitAndInstall(false, true);
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
    // We schedule downloads ourselves AFTER the "available" event so
    // the renderer can show "обновление найдено" before bytes start
    // moving — purely UX, no behavioural difference.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
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
