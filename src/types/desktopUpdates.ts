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
  check(): Promise<DesktopUpdateState | null>;
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
