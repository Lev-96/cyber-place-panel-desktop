import { BrowserWindow } from "electron";
import { probe } from "./discovery";
import type { WakeKeys } from "./credentials";

/**
 * Pairing a console with a PlayStation account, from inside the panel.
 *
 * Sony's pairing has three parts and all three now happen here: the owner signs
 * in to their PlayStation account, the console shows an eight-digit PIN, and
 * the two are exchanged with the console for a registration key. That key is
 * what every later wake carries, and what makes an authenticated session — and
 * therefore a rest command — possible at all.
 *
 * ## What is ours and what is not
 * The protocol work is playactor's: the token exchange, the account identifier,
 * the registration request and the shape of what comes back. Two things it
 * cannot do inside a desktop panel are replaced here — it asks for the PIN on
 * standard input, and it expects something to put a login page in front of the
 * user. So it is given a window and an answer.
 *
 * ## The account sign-in
 * A real Sony login page in a window of its own, with no preload and no access
 * to anything of ours. We never see the password; what comes back is the URL
 * the browser was redirected to, which carries a one-time code. Everything
 * after that is a server-to-server exchange.
 */

/** Where Sony sends the browser once the owner has signed in. */
const REDIRECT_PREFIX = "https://remoteplay.dl.playstation.net/remoteplay/redirect";

export interface PairOutcome {
  ok: boolean;
  code?: "CANCELLED" | "NOT_AWAKE" | "BAD_PIN" | "UNREACHABLE" | "NO_LOGIN" | "FAILED";
  detail?: string;
  /** What the console calls itself, once it has agreed to be paired. */
  consoleName?: string;
}

/**
 * Put the PlayStation sign-in page in front of the owner and wait for the
 * redirect that follows it.
 *
 * The window is deliberately plain: its own session, no preload, nothing of
 * ours reachable from it. It is a browser showing Sony's page, and the only
 * thing that crosses back is the redirect URL.
 */
const signInToPlayStation = (loginUrl: string, parent?: BrowserWindow): Promise<string> =>
  new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      parent,
      modal: Boolean(parent),
      autoHideMenuBar: true,
      title: "PlayStation",
      webPreferences: {
        // No bridge, no node, its own partition: this window shows somebody
        // else's login page and must not be able to reach anything of ours.
        partition: "psn-login",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      if (!win.isDestroyed()) win.destroy();
    };

    const watch = (url: string) => {
      if (url.startsWith(REDIRECT_PREFIX)) finish(() => resolve(url));
    };

    win.webContents.on("will-redirect", (_e, url) => watch(url));
    win.webContents.on("will-navigate", (_e, url) => watch(url));
    win.webContents.on("did-navigate", (_e, url) => watch(url));

    // Closing the window is an answer too — the owner changed their mind, and
    // that is not a failure to report as one.
    win.on("closed", () => finish(() => reject(new Error("CANCELLED"))));

    void win.loadURL(loginUrl);
  });

/**
 * Pair one console.
 *
 * @param address  Where the console is, from the sweep that found it.
 * @param pin      The eight digits on the console's own screen. They expire.
 * @param keys     Where the result is kept — OS-encrypted, never in the renderer.
 */
export const pairConsole = async (
  address: string,
  pin: string,
  keys: WakeKeys,
  parent?: BrowserWindow,
): Promise<PairOutcome> => {
  if (!/^\d{8}$/.test(pin.trim())) {
    return { ok: false, code: "BAD_PIN", detail: "A pairing PIN is eight digits." };
  }

  try {
    const { OauthCredentialRequester } = await import("playactor/dist/credentials/oauth/requester");

    // Our own sweep, not the library's — which works fine, but asking the same
    // question twice invites the two answers to disagree. Ours already carries
    // the raw headers the device object needs, and it is the sweep the rest of
    // this feature acts on, so it is the one that decides whether a console is
    // there.
    const found = (await probe([address], 2_000)).consoles[0];
    if (!found) return { ok: false, code: "UNREACHABLE" };

    const device = {
      address: { address, port: 9302, family: "IPv4" as const },
      hostRequestPort: Number(found.raw["host-request-port"] ?? 997),
      extras: found.raw,
      discoveryVersion: (found.raw["device-discovery-protocol-version"] ?? "00030010") as never,
      systemVersion: found.systemVersion ?? "",
      id: found.hostId,
      name: found.name,
      // The library branches on this: registration is refused from rest, and it
      // must be told the truth about which it is.
      status: (found.state === "awake" ? "AWAKE" : "STANDBY") as never,
      type: (found.type.toUpperCase().startsWith("PS4") ? "PS4" : "PS5") as never,
    };

    const io = {
      // The library narrates to a terminal there is none of. Its instructions
      // are already on the screen the owner is looking at.
      logError: () => {},
      logInfo: () => {},
      logResult: () => {},
      // The one question it asks, answered before it is asked.
      prompt: async () => pin.trim(),
    };

    const strategy = { performLogin: (url: string) => signInToPlayStation(url, parent) };

    const requester = new OauthCredentialRequester(io as never, strategy as never);
    const credentials = await requester.requestForDevice(device);

    // Everything the console agreed to, including the registration key. It goes
    // straight into the vault — nothing here returns it, logs it, or lets the
    // renderer ask for it.
    await keys.setCredentials(device.id, JSON.stringify(credentials));

    // The wake path reads a plain key; pairing produces the same value, so a
    // paired console can be woken by the datagram we already send.
    const credential = (credentials as { "user-credential"?: string })["user-credential"];
    if (credential) await keys.setWakeCredential(device.id, credential);

    return { ok: true, consoleName: device.name };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      code: /CANCELLED/.test(message) ? "CANCELLED"
        : /must be awake/i.test(message) ? "NOT_AWAKE"
          : /OAuth|access_token|code/i.test(message) ? "NO_LOGIN"
            : /not found|no device|timed out|ECONN/i.test(message) ? "UNREACHABLE"
              : /pin|regist/i.test(message) ? "BAD_PIN"
                : "FAILED",
      detail: message.slice(0, 200),
    };
  }
};
