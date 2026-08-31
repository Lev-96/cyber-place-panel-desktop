import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  get: (key: string) => ipcRenderer.invoke("kv:get", key),
  set: (key: string, value: string) => ipcRenderer.invoke("kv:set", key, value),
  remove: (key: string) => ipcRenderer.invoke("kv:remove", key),
  wakeOnLan: (mac: string) => ipcRenderer.invoke("wol:send", mac),
});

// Auto-update bridge — separate global so the renderer can feature-
// detect (`window.cyberplaceUpdates` is undefined when running against
// an older preload, e.g. dev tooling). Shape mirrors the main-process
// UpdateService surface: `check()` and `install()` are commands,
// `getState()` is a pull, `onState(cb)` returns the unsubscribe
// function for the push stream.
contextBridge.exposeInMainWorld("cyberplaceUpdates", {
  check: () => ipcRenderer.invoke("updates:check"),
  checkGated: (promotedVersion: string | null) =>
    ipcRenderer.invoke("updates:checkGated", promotedVersion),
  install: () => ipcRenderer.invoke("updates:install"),
  getState: () => ipcRenderer.invoke("updates:getState"),
  onState: (cb: (state: unknown) => void) => {
    const listener = (_e: unknown, state: unknown) => cb(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
});

/**
 * PlayStation discovery — a separate global from `desktopAPI` on purpose.
 *
 * A screen can feature-detect it (`window.cyberplacePS5` is undefined against
 * an older preload, or in a browser during development) and say so, instead of
 * throwing. The same reason `cyberplaceUpdates` is its own global.
 *
 * Discovery only. There is no wake here, because there is no wake in this
 * build: the credential that would make one possible is not part of Phase 1.
 */
contextBridge.exposeInMainWorld("cyberplacePS5", {
  discover: (timeoutMs?: number) => ipcRenderer.invoke("ps5:discover", timeoutMs),
  probe: (addresses: string[], timeoutMs?: number) =>
    ipcRenderer.invoke("ps5:probe", addresses, timeoutMs),
  /**
   * Wake a console. The key stays in the main process — this side names the
   * console and is told whether a datagram went out, nothing more.
   */
  wake: (hostId: string, address: string) => ipcRenderer.invoke("ps5:wake", hostId, address),
  /**
   * Ask a console to sleep. Answers a refusal today — the local protocol has no
   * rest command — and the shape does not change when one becomes possible.
   */
  rest: (hostId: string, address: string) => ipcRenderer.invoke("ps5:rest", hostId, address),
  capabilities: () => ipcRenderer.invoke("ps5:capabilities"),
  /**
   * Try a key once without storing it — the first thing anybody does with a new
   * console, and the only way to check a key on a machine whose OS has no
   * keystore to put one in.
   */
  wakeOnce: (address: string, registKey: string) =>
    ipcRenderer.invoke("ps5:wake-once", address, registKey),
  /**
   * The wake key: writable, checkable, never readable. There is deliberately no
   * `getCredential` — a secret a web page can read is a secret in the devtools
   * of whoever opens them.
   */
  setCredential: (hostId: string, registKey: string) =>
    ipcRenderer.invoke("ps5:credential:set", hostId, registKey),
  hasCredential: (hostId: string) => ipcRenderer.invoke("ps5:credential:has", hostId),
  forgetCredential: (hostId: string) => ipcRenderer.invoke("ps5:credential:forget", hostId),
});
