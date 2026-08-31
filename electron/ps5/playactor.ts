import { WakeKeys } from "./credentials";

/**
 * Pairing, waking and resting a console, through playactor.
 *
 * ## Why a library at all
 * Waking is one datagram and we send it ourselves. Everything else a console
 * will do over the network — being paired with an account in the first place,
 * and being asked to go to rest — happens inside an authenticated Remote Play
 * session: a key exchange over TCP 9295 and an encrypted control channel. That
 * is not a packet, it is a protocol, and the parts of it that come from Sony's
 * own client cannot be derived from a specification because there is none.
 *
 * playactor implements it and is ISC-licensed, which is the whole reason it is
 * here: the other complete implementation of this protocol is AGPL-3.0, and
 * putting AGPL code inside Cyber Place would oblige the whole product to be
 * released under AGPL. ISC does not.
 *
 * ## What it is allowed to touch
 * Nothing but the console. Its credential storage is ours — the same
 * OS-encrypted vault the wake key already lives in — so the pairing result
 * never reaches the renderer and never lands on disk in the clear. Its
 * interactive prompts are replaced too: a library that asks for a PIN on
 * standard input is no use inside a panel, so the PIN is handed in.
 *
 * ## What is NOT verified
 * Every line below is written against the library's own types and a console
 * that answers discovery. Pairing itself has never run here: it needs a live
 * PIN from the console screen and a PlayStation account. Until that happens
 * this is code that should work, which is a different thing from code that has.
 */

/** What playactor stores for a paired console. Opaque to us beyond its shape. */
interface StoredCredentials {
  accountId: string;
  "user-credential": string;
  registration?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * playactor's credential store, backed by the vault the wake key uses.
 *
 * The library would otherwise write a JSON file in the user's home directory,
 * in the clear. What it hands us includes the console's registration key —
 * the thing that lets anyone on the network switch it on — so it goes where
 * the operating system can encrypt it, and nowhere else.
 */
class VaultStorage {
  constructor(private readonly keys: WakeKeys) {}

  async read(deviceId: string): Promise<StoredCredentials | null> {
    const raw = this.keys.readCredentials(deviceId);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredCredentials;
    } catch {
      // Written by an older shape, or corrupted. Treated as "not paired",
      // which asks the owner to pair again rather than failing obscurely.
      return null;
    }
  }

  async write(deviceId: string, credentials: StoredCredentials): Promise<void> {
    await this.keys.setCredentials(deviceId, JSON.stringify(credentials));
  }
}

/**
 * The PIN, supplied rather than prompted for.
 *
 * playactor's own requester reads from the terminal and opens a browser. Inside
 * a panel neither is available, so pairing hands the PIN in and this simply
 * repeats it. If pairing was not started from the panel there is nothing to
 * repeat, and saying so beats a prompt nobody can see.
 */
class SuppliedPin {
  constructor(private readonly pin: string, private readonly accountId: string) {}

  async requestForDevice(): Promise<{ pin: string; accountId: string }> {
    if (!this.pin) throw new Error("NO_PIN");

    return { pin: this.pin, accountId: this.accountId };
  }
}

export interface PairResult {
  ok: boolean;
  code?: "NO_PIN" | "NOT_AWAKE" | "REJECTED" | "UNREACHABLE" | "FAILED" | "IN_USE";
  detail?: string;
}

/**
 * Pair a console with an account, so that later it can be woken and rested.
 *
 * The console must be AWAKE: registration is refused in rest mode, which the
 * library says in as many words. That is worth surfacing rather than
 * translating into a generic failure — it is the one instruction that gets a
 * stuck owner unstuck.
 */
export const pair = async (
  address: string,
  accountId: string,
  pin: string,
  keys: WakeKeys,
): Promise<PairResult> => {
  if (!pin) return { ok: false, code: "NO_PIN" };

  try {
    const { PendingDevice } = await import("playactor/dist/device/pending");
    const { CredentialManager } = await import("playactor/dist/credentials");

    const manager = new CredentialManager(
      new SuppliedPin(pin, accountId) as never,
      new VaultStorage(keys) as never,
    );

    const device = new PendingDevice(
      `console at ${address}`,
      (found: { address?: { address?: string } }) => found.address?.address === address,
      undefined,
      undefined,
      undefined,
      manager,
    );

    const connection = await device.openConnection();
    await connection.close();

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      // The library's own words, mapped to the three things an owner can
      // actually do about them.
      code: /must be awake/i.test(message) ? "NOT_AWAKE"
        : /not found|no device|timed out/i.test(message) ? "UNREACHABLE"
          : /credential|regist|pin/i.test(message) ? "REJECTED"
            : "FAILED",
      detail: message.slice(0, 200),
    };
  }
};

/**
 * Ask a paired console to go to rest.
 *
 * This is the half the discovery protocol has no command for: it opens the
 * authenticated session and sends the standby request inside it. It needs the
 * console to have been paired, and it needs it to be awake — asking a sleeping
 * console to sleep is not an error worth reporting as a failure.
 */
/**
 * How many times to ask before calling it a failure, and how long to wait
 * between.
 *
 * Measured on a real console: the first session request is sometimes refused
 * with a transient 403 and the next one, eight seconds later, is accepted — the
 * console then sleeps within five. Reporting the first refusal as the answer is
 * what made "press No and nothing happens" true: the panel gave up and waited
 * out its backoff while the console was perfectly willing to be asked again.
 */
const STANDBY_ATTEMPTS = 3;
const STANDBY_RETRY_MS = 4_000;

/**
 * Refusals that will not change by asking again in a few seconds.
 *
 * A console holding a Remote Play session says so until something on the
 * console frees it — measured at three minutes of complete silence and still
 * refusing — and an unpaired console will not pair itself. Retrying either is
 * noise. Everything else has been seen to clear on the next attempt.
 */
export const isPermanentRefusal = (code: PairResult["code"]): boolean =>
  code === "REJECTED" || code === "IN_USE";

export const standby = async (address: string, keys: WakeKeys): Promise<PairResult> => {
  let last: PairResult = { ok: false, code: "FAILED" };

  for (let attempt = 1; attempt <= STANDBY_ATTEMPTS; attempt++) {
    last = await standbyOnce(address, keys);
    if (last.ok || isPermanentRefusal(last.code)) return last;

    if (attempt < STANDBY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, STANDBY_RETRY_MS));
    }
  }

  return last;
};

/** One attempt: open the session, ask, and close whatever happened. */
const standbyOnce = async (address: string, keys: WakeKeys): Promise<PairResult> => {
  try {
    const { PendingDevice } = await import("playactor/dist/device/pending");
    const { CredentialManager } = await import("playactor/dist/credentials");

    const manager = new CredentialManager(
      // Nothing to ask: a console that is not paired cannot be rested, and the
      // owner is told that rather than being prompted mid-shift.
      { requestForDevice: async () => { throw new Error("NOT_PAIRED"); } } as never,
      new VaultStorage(keys) as never,
    );

    const device = new PendingDevice(
      `console at ${address}`,
      (found: { address?: { address?: string } }) => found.address?.address === address,
      undefined,
      undefined,
      undefined,
      manager,
    );

    const connection = await device.openConnection();
    try {
      await connection.standby();
    } finally {
      // Always, even when the request above threw. A session left open is one
      // the console goes on holding, and the next attempt is then refused with
      // "already in use" — by us, against ourselves.
      await connection.close().catch(() => {});
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      // The console's own refusals, kept apart because they need different
      // things done about them. "Already in use" is not a failure to reach it.
      code: /already in use|in use/i.test(message) ? "IN_USE"
        : /NOT_PAIRED|credential/i.test(message) ? "REJECTED"
          : /not found|no device|timed out|unable to locate/i.test(message) ? "UNREACHABLE"
            : "FAILED",
      detail: message.slice(0, 200),
    };
  }
};
