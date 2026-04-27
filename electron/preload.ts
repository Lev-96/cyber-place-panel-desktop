import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  get: (key: string) => ipcRenderer.invoke("kv:get", key),
  set: (key: string, value: string) => ipcRenderer.invoke("kv:set", key, value),
  remove: (key: string) => ipcRenderer.invoke("kv:remove", key),
});
