import { BrowserWindow, app, ipcMain, net, protocol, session, shell } from "electron";
import { createSocket } from "node:dgram";
import { existsSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Store } from "./storage";
import { UpdateService, broadcastUpdateState } from "./updates/UpdateService";
import { bundledIconPath, ensureLinuxDesktopIntegration } from "./linuxIntegration";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "";
const isDev = DEV_URL.length > 0 || !app.isPackaged;

// Silence Chromium's own diagnostic chatter (CSP warnings, GL probes,
// Autofill devtools messages, GPU info, etc.). Same approach Discord and
// other consumer Electron apps use — production users shouldn't see logs.
app.commandLine.appendSwitch("log-level", "3");           // FATAL only
app.commandLine.appendSwitch("disable-logging");
app.commandLine.appendSwitch("disable-features", "Autofill");

// Cap Chromium's HTTP disk cache at 50 MB. Default cap is per-origin and
// can balloon over months on long-running staff PCs. Hard cap from the
// switch + boot-time clear + hourly periodic purge (below) keep the
// userData dir from quietly accumulating gigabytes of throwaway data.
app.commandLine.appendSwitch("disk-cache-size", String(50 * 1024 * 1024));

let store: Store | null = null;
let mainWindow: BrowserWindow | null = null;
let updateService: UpdateService | null = null;

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

  // Linux only: register a .desktop file in ~/.local/share/applications/
  // on every launch so AppImage installs show up in the system menu
  // with the brand icon (no AppImageLauncher dependency). No-op on
  // Windows/macOS — those have their own installer-driven shortcuts.
  ensureLinuxDesktopIntegration({
    appId: "cyberplace-panel",
    displayName: "Cyberplace Panel",
    comment: "Cyber Place staff panel — bookings, sessions, billing",
    iconSourcePath: bundledIconPath(),
  });

  // Auto-clear non-essential caches on every startup. Keeps the userData
  // directory from growing unbounded over time. We DO keep cookies/localStorage
  // (that's the user's auth token via KV store).
  const purgeThrowawayCaches = async () => {
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ["shadercache", "cachestorage"],
      });
      await session.defaultSession.clearCodeCaches({});
    } catch { /* best-effort */ }
  };
  await purgeThrowawayCaches();

  // Long-running staff windows (panel that nobody quits for weeks) need
  // mid-runtime housekeeping too — startup-only would let HTTP + shader
  // + code caches creep back up between restarts. Hourly is conservative
  // (no perceptible UI impact, no auth state touched) and still keeps
  // total cache well below the 50 MB switch cap above.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => { void purgeThrowawayCaches(); }, ONE_HOUR_MS);

  ipcMain.handle("kv:get", (_e: unknown, key: string) => store?.get(key) ?? null);
  ipcMain.handle("kv:set", (_e: unknown, key: string, value: string) => store?.set(key, value));
  ipcMain.handle("kv:remove", (_e: unknown, key: string) => store?.remove(key));

  ipcMain.handle("wol:send", (_e: unknown, mac: string) => sendMagicPacket(mac));

  // Auto-update bridge — the singleton service owns electron-updater's
  // event stream; we just expose three IPC channels for the renderer:
  //   updates:check          — start a check (returns initial state)
  //   updates:install        — quit + install the downloaded version
  //   updates:getState       — pull current state on mount
  // Renderer also subscribes to the `updates:state` push so it can
  // re-render on download progress without polling.
  //
  // We skip auto-update entirely in dev (no published artifacts to
  // fetch, electron-updater errors out trying), but still register the
  // IPC channels so the renderer's update screen renders the same
  // empty state in dev as it would on an unconfigured machine.
  updateService = new UpdateService("panel");
  updateService.onState(broadcastUpdateState);
  ipcMain.handle("updates:check", async () => {
    if (!updateService) return null;
    if (isDev) return updateService.getState();
    return updateService.check();
  });
  // Gated check — the renderer passes the admin-promoted version (from the
  // `app-update.promoted` broadcast or `/updates/panel/manifest`), and the
  // service downloads ONLY when the GitHub channel version equals it. This
  // is the boundary that keeps owner/manager panels from self-updating
  // before an admin has approved a version.
  ipcMain.handle("updates:checkGated", async (_e: unknown, promotedVersion: string | null) => {
    if (!updateService) return null;
    if (isDev) return updateService.getState();
    return updateService.checkGated(promotedVersion ?? null);
  });
  ipcMain.handle("updates:install", () => {
    updateService?.installAndRestart();
  });
  ipcMain.handle("updates:getState", () => updateService?.getState() ?? null);

  // No autonomous boot check: a download must be authorised by an admin
  // promote. Catch-up for a panel that was offline during the promote is
  // renderer-driven — on mount it reads `/updates/panel/manifest` and, if
  // a version is promoted, calls `updates:checkGated`. That keeps the
  // backend promote pointer the single source of truth for what installs.

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
