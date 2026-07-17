/**
 * Shared types for the `window.cyberplaceUpdates` IPC bridge exposed
 * by `electron/preload.ts`. Mirrors the main-process `UpdateService`
 * shape one-for-one. Kept in `types/` (rather than next to the hook)
 * so any renderer file can import the types without dragging React
 * imports in.
 */

export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface DesktopUpdateState {
  status: DesktopUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  progressPercent: number | null;
  notes: string | null;
  error: string | null;
}

export interface DesktopUpdatesBridge {
  /** Plain check — reports availability but never downloads. */
  check(): Promise<DesktopUpdateState | null>;
  /**
   * Gated check for the admin-driven rollout. Downloads ONLY when the
   * version on the GitHub channel equals `promotedVersion` (the version an
   * admin has promoted on the backend). Pass null for "nothing approved".
   */
  checkGated(promotedVersion: string | null): Promise<DesktopUpdateState | null>;
  install(): Promise<void>;
  getState(): Promise<DesktopUpdateState | null>;
  onState(cb: (state: DesktopUpdateState) => void): () => void;
}

declare global {
  interface Window {
    /**
     * Present only when running under the Electron preload (renderer
     * inside the desktop bundle). Undefined in a browser tab or under
     * `npm run dev` without the wrapper — callers MUST feature-detect.
     */
    cyberplaceUpdates?: DesktopUpdatesBridge;
  }
}

export {};
