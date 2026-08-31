import { BrowserWindow, Menu, MenuItemConstructorOptions, app, ipcMain, net, protocol, screen, session, shell } from "electron";
import { createSocket } from "node:dgram";
import { existsSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Store } from "./storage";
import { UpdateService, broadcastUpdateState } from "./updates/UpdateService";
import { bundledIconPath, ensureLinuxDesktopIntegration } from "./linuxIntegration";
import { mayNavigateTo, mayOpenExternally, navigationKeyFor } from "./urlPolicy";
import { discover as discoverPlayStations, probe as probePlayStations } from "./ps5/discovery";
import { activeTransport, useCredentialVault } from "./ps5/transport";
import { WakeKeys } from "./ps5/credentials";
import { wake as wakePlayStation } from "./ps5/wake";

// `isDev` follows how the app was BUILT, never the environment it starts in.
// Previously a packaged panel launched with ELECTRON_DEV_URL set would load
// that URL with the preload attached — and this preload exposes `kv:get`,
// which returns the operator's Sanctum token. Reading DEV_URL only in an
// unpackaged build keeps the developer workflow identical.
const isDev = !app.isPackaged;
const DEV_URL = isDev ? (process.env.ELECTRON_DEV_URL ?? "") : "";

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
// Console wake keys, encrypted by the OS. Loaded once at boot like the kv
// store; a null here means the app has not finished starting, never "no keys".
let wakeKeys: WakeKeys | null = null;
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

/**
 * Default content size of the main window, in CSS pixels.
 *
 * Measured from the layout the login screen was signed off at, and expressed
 * as CONTENT rather than frame size — see the note at the BrowserWindow call.
 */
const DEFAULT_CONTENT = { width: 1150, height: 890 } as const;

/**
 * Margin left around the window when a display cannot fit the default.
 * Enough to keep the frame, a taskbar shadow and a drop shadow clear of the
 * screen edges.
 */
const SCREEN_MARGIN = 60;

/**
 * The size to open at on THIS machine.
 *
 * The default is a preference, not a promise: a 1366×768 laptop cannot show a
 * 1150×890 window, and opening one there would push the sign-in button off the
 * bottom of the screen with no way to reach it. Clamping to the display's work
 * area — which already excludes taskbars and docks — is what makes one default
 * safe on every system rather than only on the machine it was measured on.
 */
const preferredWindowSize = () => {
  const { workAreaSize } = screen.getPrimaryDisplay();

  return {
    width: Math.min(DEFAULT_CONTENT.width, Math.max(960, workAreaSize.width - SCREEN_MARGIN)),
    height: Math.min(DEFAULT_CONTENT.height, Math.max(600, workAreaSize.height - SCREEN_MARGIN)),
  };
};

const createWindow = async () => {
  const { width, height } = preferredWindowSize();

  mainWindow = new BrowserWindow({
    width,
    height,
    // These numbers describe the WEB CONTENT, not the outer frame. Title bars
    // differ in height across Windows, macOS and every Linux window manager,
    // so sizing the frame would hand each platform a slightly different canvas
    // — and the login composition is laid out against the viewport. Content
    // sizing is what makes it identical everywhere.
    useContentSize: true,
    center: true,
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

  // Only hand the OS a URL we are willing to act on. The URLs arriving here
  // are server-supplied (Pulse entry link, Metrika dashboard), so an
  // unrestricted openExternal would let a hostile or compromised backend
  // response launch `file://`, `smb://` or a Windows handler URI.
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (mayOpenExternally(url)) {
      void shell.openExternal(url);
    } else {
      console.warn("[panel] refused to open external URL:", url);
    }
    return { action: "deny" as const };
  });

  // The top-level frame may never leave the bundled app. If it did, the
  // preload — and `kv:get`, which returns the Sanctum token — would follow.
  const allowedNavigation = [
    `${APP_SCHEME}://localhost`,
    ...(isDev && DEV_URL ? [navigationKeyFor(DEV_URL) ?? ""] : []),
  ].filter(Boolean);

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!mayNavigateTo(url, allowedNavigation)) {
      event.preventDefault();
      console.warn("[panel] blocked navigation to", url);
    }
  });

  // Native right-click menu. Electron ships none by default, so without this
  // the renderer's context menu does nothing. Copy shows whenever text is
  // selected; cut/copy/paste/select-all show in editable fields (inputs).
  mainWindow.webContents.on("context-menu", (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];
    const hasSelection = params.selectionText.trim().length > 0;
    if (params.isEditable) {
      items.push(
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll", enabled: params.editFlags.canSelectAll },
      );
    } else if (hasSelection) {
      items.push(
        { role: "copy" },
        { type: "separator" },
        { role: "selectAll", enabled: params.editFlags.canSelectAll },
      );
    }
    if (items.length && mainWindow) {
      Menu.buildFromTemplate(items).popup({ window: mainWindow });
    }
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

/**
 * Point Electron at the secret store this machine actually has.
 *
 * On Linux, Electron picks a backend from the desktop environment: KDE means
 * kwallet, GNOME means libsecret. A KDE session with no kwallet running — which
 * is an ordinary state, and what one venue's computer turned out to be — leaves
 * `safeStorage` reporting that nothing is available, even with gnome-keyring
 * running right beside it. The console wake key then could not be stored at
 * all, and a session had nothing to wake the console with.
 *
 * So: if gnome-keyring is running, say so. Its control socket in the user's
 * runtime directory is the check, and it is the daemon's own socket rather than
 * a guess from an environment variable. Where the socket is absent nothing is
 * overridden and Electron's own choice stands.
 *
 * Must run before `whenReady` — the backend cannot be chosen afterwards.
 */
const preferAvailableSecretStore = (): void => {
  if (process.platform !== "linux") return;

  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (!runtimeDir) return;

  try {
    if (!existsSync(join(runtimeDir, "keyring", "control"))) return;
  } catch {
    return;
  }

  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
};

preferAvailableSecretStore();

app.whenReady().then(async () => {
  store = new Store(join(app.getPath("userData"), "cyberplace.kv.json"));
  wakeKeys = new WakeKeys(join(app.getPath("userData"), "cyberplace.ps5-keys.json"));
  await wakeKeys.load();
  // The transport can rest a console only once it can reach the pairing
  // credentials, so it is told about the vault rather than reaching for one.
  useCredentialVault(wakeKeys);
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

  /**
   * Find PlayStations on the club's own network.
   *
   * Here rather than on the server for the same reason `wol:send` is: the
   * backend runs in a datacentre and shares no broadcast domain with any club,
   * while this process runs on a machine in the room with the consoles.
   *
   * Read-only. It asks; it cannot wake, rest, or alter a console — that needs a
   * credential this build does not carry.
   */
  ipcMain.handle("ps5:discover", (_e: unknown, timeoutMs?: number) =>
    discoverPlayStations(typeof timeoutMs === "number" ? { timeoutMs } : {}));

  /**
   * Ask the consoles we already know about how they are doing.
   *
   * Separate from `ps5:discover` because the two have opposite costs: a sweep
   * shouts at the whole network and belongs behind a button, while this is a
   * handful of unicast datagrams and runs on a timer all shift.
   */
  /**
   * Wake one console.
   *
   * The key never leaves this process: the renderer names a console, and the
   * main process looks up what it is allowed to send. A renderer that asked for
   * the key itself would be a renderer that could leak it.
   */
  ipcMain.handle("ps5:wake", async (_e: unknown, hostId: unknown, address: unknown) => {
    if (typeof hostId !== "string" || typeof address !== "string") {
      return { sent: false, reason: "bad-request" };
    }

    return wakePlayStation(address, wakeKeys?.read(hostId) ?? null);
  });

  /**
   * Ask a console to go to rest.
   *
   * Routed through the transport, which today answers
   * `UNSUPPORTED_BY_TRANSPORT`: the local discovery protocol has no such
   * command. The refusal is returned rather than swallowed, so the panel can
   * say the console is still awake instead of showing a sleep that never
   * happened. When a rest-capable transport exists this channel does not change.
   */
  ipcMain.handle("ps5:rest", async (_e: unknown, hostId: unknown, address: unknown) => {
    if (typeof hostId !== "string" || typeof address !== "string") {
      return { sent: false, code: "INVALID_STATE" };
    }

    return activeTransport().requestRest(address);
  });

  /** What the current transport can actually do, for a screen that must not promise more. */
  ipcMain.handle("ps5:capabilities", () => activeTransport().capabilities);

  /**
   * Wake a console with a key that is used once and not kept.
   *
   * The storing path refuses a machine whose OS offers no keystore, which is
   * right — a key written as readable text on a computer the whole shift walks
   * past is not a lesser evil. But it also blocks the very first thing anybody
   * needs to do with a new console: find out whether the key they were given
   * actually works.
   *
   * This is that check. The key comes straight from the field the owner typed
   * it into, goes into one datagram, and is referenced nowhere afterwards —
   * nothing writes it to disk, nothing logs it, and there is no path that reads
   * it back.
   */
  ipcMain.handle("ps5:wake-once", async (_e: unknown, address: unknown, registKey: unknown) => {
    if (typeof address !== "string" || typeof registKey !== "string") {
      return { sent: false, reason: "bad-request" };
    }

    return wakePlayStation(address, registKey);
  });

  /**
   * Remember a console's wake key. The renderer can write one and ask whether
   * one exists; it can never read one back.
   */
  ipcMain.handle("ps5:credential:set", async (_e: unknown, hostId: unknown, registKey: unknown) => {
    if (typeof hostId !== "string" || typeof registKey !== "string" || !wakeKeys) {
      return { saved: false, reason: "bad-request" };
    }

    // Always accepted. Where the OS offers a keystore the key survives a
    // restart; where it does not, it lives in this process and nothing is
    // written to disk. `persisted` is which of the two happened, and the screen
    // tells the operator rather than leaving them to find out tomorrow.
    return wakeKeys.set(hostId, registKey);
  });

  ipcMain.handle("ps5:credential:has", (_e: unknown, hostId: unknown) => ({
    has: typeof hostId === "string" && (wakeKeys?.has(hostId) ?? false),
    available: wakeKeys?.available() ?? false,
    persisted: typeof hostId === "string" && (wakeKeys?.isPersisted(hostId) ?? false),
  }));

  ipcMain.handle("ps5:credential:forget", async (_e: unknown, hostId: unknown) => {
    if (typeof hostId === "string") await wakeKeys?.forget(hostId);
    return { ok: true };
  });

  ipcMain.handle("ps5:probe", (_e: unknown, addresses: unknown, timeoutMs?: number) =>
    probePlayStations(
      // Whatever the renderer sends is treated as untrusted shape, not just
      // untrusted values: this is the one boundary where a bad type would
      // otherwise reach a socket call.
      Array.isArray(addresses) ? addresses.filter((a): a is string => typeof a === "string") : [],
      typeof timeoutMs === "number" ? timeoutMs : undefined,
    ));

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
