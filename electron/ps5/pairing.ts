import { BrowserWindow, net, shell } from "electron";
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

/**
 * Sony's own Remote Play client identity, and the endpoints that go with it.
 *
 * These are what a Remote Play client presents when it asks an account for
 * permission to pair a console. They are not secrets — every client that does
 * this shows the same ones — and there is no alternative set: the console will
 * only accept a registration made under this identity.
 */
const CLIENT_ID = "ba495a24-818c-472b-b12d-ff231c1b5745";
const CLIENT_SECRET = "mvaiZkRsAsI1IBkY";
const TOKEN_URL = "https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/token";

export const psnLoginUrl = (): string =>
  "https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/authorize"
  + "?service_entity=urn:service-entity:psn&response_type=code"
  + `&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_PREFIX}`
  + "&scope=psn:clientapp&request_locale=en_US&ui=pr&service_logo=ps"
  + "&layout_type=popup&smcid=remoteplay&prompt=always&PlatformPrivacyWs1=minimal&";

/** Open the sign-in in the owner's own browser, where they are probably signed in already. */
export const openPsnLoginExternally = async (): Promise<void> => {
  await shell.openExternal(psnLoginUrl());
};

/** A small JSON request through Electron's own networking stack. */
const request = async (url: string, init: { method?: string; body?: string; type?: string }) => {
  const response = await net.fetch(url, {
    method: init.method ?? "GET",
    headers: {
      // The client identity travels as basic auth, exactly as Sony's own
      // client sends it.
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      ...(init.type ? { "Content-Type": init.type } : {}),
    },
    body: init.body,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json() as Promise<Record<string, unknown>>;
};

/**
 * The account identifier a console registration is made under.
 *
 * Sony's account id is a decimal number; what the console expects is its eight
 * bytes, little-endian, base64. Getting this wrong produces a registration the
 * console refuses without saying why.
 */
const accountIdFrom = (userId: string): string => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(userId));

  return buffer.toString("base64");
};

/**
 * Turn the address the browser ended up at into an account identifier.
 *
 * The owner signs in wherever they like — in the window this app opens, or in
 * their own browser — and what comes back is a URL carrying a one-time code.
 * The exchange after that never involves their password.
 */
export const accountIdFromRedirect = async (redirectUrl: string): Promise<string> => {
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error("NO_CODE");

  const token = await request(TOKEN_URL, {
    method: "POST",
    type: "application/x-www-form-urlencoded",
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_PREFIX,
    }).toString(),
  });

  const accessToken = token["access_token"];
  if (typeof accessToken !== "string") throw new Error("NO_TOKEN");

  const account = await request(`${TOKEN_URL}/${accessToken}`, {});
  const userId = account["user_id"];
  if (typeof userId !== "string" && typeof userId !== "number") throw new Error("NO_ACCOUNT");

  return accountIdFrom(String(userId));
};

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
  /**
   * The URL the browser was redirected to after signing in, when the owner did
   * that in their own browser rather than in the window this opens. Sony's page
   * refuses some clients outright — with an edge-server error that has nothing
   * to do with the credentials typed into it — and a venue cannot be left with
   * no way through because of that.
   */
  redirectUrl?: string,
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

    // Either the owner signs in here, or they already did it in their own
    // browser and pasted back where it sent them. The rest is identical.
    const strategyToUse = redirectUrl
      ? { performLogin: async () => redirectUrl }
      : strategy;

    const requester = new OauthCredentialRequester(io as never, strategyToUse as never);
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
