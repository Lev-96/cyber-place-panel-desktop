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
