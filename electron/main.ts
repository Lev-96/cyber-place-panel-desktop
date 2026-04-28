import { BrowserWindow, app, ipcMain, net, protocol, shell } from "electron";
import { existsSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

/**
 * Custom protocol handler that serves the Vite-built bundle from disk.
 * Using a privileged protocol (instead of file://) means:
 *   - relative `./assets/...` paths resolve against the app:// origin
 *   - `crossorigin` attribute on Vite's module scripts works
 *   - we keep `sandbox: true` for the renderer
 */
const APP_SCHEME = "app";

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const registerAppProtocol = (root: string) => {
  protocol.handle(APP_SCHEME, (req) => {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname || "/");
    const safe = normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
    let file = resolve(root, "." + (safe === "/" ? "/index.html" : safe));
    if (!file.startsWith(root)) {
      return new Response("forbidden", { status: 403 });
    }
    if (!existsSync(file)) file = resolve(root, "./index.html"); // SPA fallback
    return net.fetch(pathToFileURL(file).toString());
  });
};

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

  // Surface renderer errors to terminal during development.
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[renderer-gone]", details);
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[did-fail-load]", code, desc, url);
  });
  mainWindow.webContents.on("console-message", (_e, level, msg, line, src) => {
    if (level >= 2) console.error("[renderer]", msg, src + ":" + line);
  });

  if (isDev && DEV_URL) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    await mainWindow.loadURL(`${APP_SCHEME}://localhost/index.html`);
  }
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.on("closed", () => { mainWindow = null; });
};

app.whenReady().then(async () => {
  store = new Store(join(app.getPath("userData"), "cyberplace.kv.json"));
  await store.load();

  ipcMain.handle("kv:get", (_e: unknown, key: string) => store?.get(key) ?? null);
  ipcMain.handle("kv:set", (_e: unknown, key: string, value: string) => store?.set(key, value));
  ipcMain.handle("kv:remove", (_e: unknown, key: string) => store?.remove(key));

  if (!(isDev && DEV_URL)) {
    const root = join(__dirname, "..", "..", "dist", "web");
    if (existsSync(join(root, "index.html"))) registerAppProtocol(root);
  }

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
