import { BrowserWindow, app, ipcMain, net, protocol, session, shell } from "electron";
import { createSocket } from "node:dgram";
import { existsSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Store } from "./storage";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "";
const isDev = DEV_URL.length > 0 || !app.isPackaged;

// Silence Chromium's own diagnostic chatter (CSP warnings, GL probes,
// Autofill devtools messages, GPU info, etc.). Same approach Discord and
// other consumer Electron apps use — production users shouldn't see logs.
app.commandLine.appendSwitch("log-level", "3");           // FATAL only
app.commandLine.appendSwitch("disable-logging");
app.commandLine.appendSwitch("disable-features", "Autofill");

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

  if (isDev && DEV_URL) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    await mainWindow.loadURL(`${APP_SCHEME}://localhost/index.html`);
  }
  // Auto-open DevTools only when explicitly requested. A detached DevTools
  // window would steal keyboard focus from the renderer.
  if (process.env.ELECTRON_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => { mainWindow = null; });
};

app.whenReady().then(async () => {
  store = new Store(join(app.getPath("userData"), "cyberplace.kv.json"));
  await store.load();

  // Auto-clear non-essential caches on every startup. Keeps the userData
  // directory from growing unbounded over time. We DO keep cookies/localStorage
  // (that's the user's auth token via KV store).
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ["shadercache", "cachestorage"],
    });
    await session.defaultSession.clearCodeCaches({});
  } catch { /* best-effort */ }

  ipcMain.handle("kv:get", (_e: unknown, key: string) => store?.get(key) ?? null);
  ipcMain.handle("kv:set", (_e: unknown, key: string, value: string) => store?.set(key, value));
  ipcMain.handle("kv:remove", (_e: unknown, key: string) => store?.remove(key));

  ipcMain.handle("wol:send", (_e: unknown, mac: string) => sendMagicPacket(mac));

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

interface WolResult {
  ok: boolean;
  mac: string;
  sent: number;
  errors: string[];
  message: string;
}

const sendMagicPacket = async (mac: string): Promise<WolResult> => {
  const hex = mac.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) {
    return { ok: false, mac, sent: 0, errors: [], message: "Invalid MAC address. Expected 6 hex bytes (e.g. AA:BB:CC:DD:EE:FF)." };
  }
  const macBytes = Buffer.from(hex, "hex");
  const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(macBytes)]);
  const targets = ["255.255.255.255", "192.168.255.255", "192.168.1.255", "10.255.255.255"];
  const ports = [9, 7];

  const sock = createSocket("udp4");
  await new Promise<void>((res, rej) => {
    sock.once("error", rej);
    sock.bind(0, () => { sock.setBroadcast(true); res(); });
  }).catch((e: Error) => {
    return { ok: false, mac, sent: 0, errors: [e.message], message: "Failed to open UDP socket." };
  });

  const errors: string[] = [];
  let sent = 0;
  for (const ip of targets) {
    for (const port of ports) {
      await new Promise<void>((resolve) => {
        sock.send(packet, port, ip, (err) => {
          if (err) errors.push(`${ip}:${port} ${err.message}`);
          else sent++;
          resolve();
        });
      });
    }
  }
  sock.close();

  return {
    ok: sent > 0,
    mac,
    sent,
    errors,
    message: sent > 0 ? "Magic packet sent." : "Failed to send magic packet.",
  };
};
