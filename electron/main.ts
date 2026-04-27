import { BrowserWindow, app, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Store } from "./storage";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "";
const isDev = DEV_URL.length > 0 || !app.isPackaged;

let store: Store | null = null;
let mainWindow: BrowserWindow | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#020514",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: "deny" as const };
  });

  if (isDev && DEV_URL) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    const indexPath = join(__dirname, "..", "..", "dist", "web", "index.html");
    if (existsSync(indexPath)) await mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => { mainWindow = null; });
};

app.whenReady().then(async () => {
  store = new Store(join(app.getPath("userData"), "cyberplace.kv.json"));
  await store.load();

  ipcMain.handle("kv:get", (_e: unknown, key: string) => store?.get(key) ?? null);
  ipcMain.handle("kv:set", (_e: unknown, key: string, value: string) => store?.set(key, value));
  ipcMain.handle("kv:remove", (_e: unknown, key: string) => store?.remove(key));

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
