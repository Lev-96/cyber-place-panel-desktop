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
  code?: "NO_PIN" | "NOT_AWAKE" | "REJECTED" | "UNREACHABLE" | "FAILED" | "IN_USE" | "CANCELLED" | "TIMEOUT";
  detail?: string;
}

/**
 * Where playactor looks for the console before it connects (2026-10-18).
 *
 * Left to itself it sends its SRCH to 255.255.255.255 from a socket bound to
 * every address, and Windows sends that out of the default-route interface
 * only. On a club PC with the console LAN (no gateway) and a USB modem (the
 * default route), it left through the modem and the console was "not found":
 * pairing and rest both failed while wake, which is unicast, worked. Aimed at
 * the address the panel already knows, the SRCH follows the LAN's own route.
 * The console is still matched by host-id, so a lease that now belongs to a
 * different console is not acted on.
 */
/**
 * playactor's discovery aimed at one address, asking once a second.
 *
 * Its default is a ping every 5 s. A PS5 on Wi-Fi answers about a third of
 * them (measured 2026-10-27), so finding the console before a standby could
 * take 15 s, and one attempt missed every ping about one time in five —
 * reported as "not on the network" while the console sat there awake.
 */
export const DISCOVERY_PING_MS = 1_000;
/**
 * How long playactor looks for the console before it gives up (its default is
 * 30 s). A console that answers at all is found within a few seconds; a
 * search that has not found it in 15 s ends, and the attempt is retried
 * inside the same command instead of spending the whole budget on one search.
 */
export const DISCOVERY_TIMEOUT_MS = 15_000;

export const aimedAt = (address: string): { deviceIp: string; pingIntervalMillis: number; timeoutMillis: number } =>
  ({ deviceIp: address, pingIntervalMillis: DISCOVERY_PING_MS, timeoutMillis: DISCOVERY_TIMEOUT_MS });

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
      aimedAt(address),
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
 * The ceiling on one attempt, and on the whole call.
 *
 * playactor waits out its own discovery before it will say a console is not
 * there, and asking three times turned "put this console to sleep" into a
 * request that took **144 seconds** to fail — measured, against a console that
 * had left the network. Nothing else may be sent to that console while one
 * command is in flight, so those two and a half minutes were two and a half
 * minutes in which pressing Start woke nothing. That is the whole of "it
 * depends on what happened before".
 *
 * A rest that is going to work is done in a few seconds: the connection opens,
 * the request goes, the console is asleep within five. These are generous
 * against that and merciless against the failing path, which is the trade the
 * floor needs — a failure reported in seconds is retried by the monitor on its
 * next observation, with a fresh reading of what the console is actually doing.
 */
/*
 * Measured again 2026-10-27 on a console on Wi-Fi: found in 2 s, then its
 * Remote Play session took 31.6 s to answer. A 20 s ceiling reported that as
 * "not on the network" — and the abandoned attempt went on and put the console
 * to sleep a dozen seconds later, after the panel had moved on. The ceilings
 * now fit a slow console, and an attempt that is abandoned can no longer send
 * its standby (see `standby`).
 */
const STANDBY_ATTEMPT_TIMEOUT_MS = 45_000;
const STANDBY_TOTAL_TIMEOUT_MS = 60_000;
/** How often a running attempt is checked for a withdrawal. */
const CANCEL_POLL_MS = 250;

/** Resolve to a timeout result rather than hanging on a library that will not return. */
export const withCeiling = async (
  work: Promise<PairResult>,
  ms: number,
): Promise<PairResult> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const ceiling = new Promise<PairResult>((resolve) => {
    timer = setTimeout(
      // The console was asked and did not finish answering in time — not the
      // same sentence as "it is not on the network".
      () => resolve({ ok: false, code: "TIMEOUT", detail: `Timed out after ${ms}ms` }),
      ms,
    );
  });

  try {
    // The abandoned attempt is not cancellable — playactor owns that socket —
    // but its own `finally` still closes the connection when it settles, so
    // nothing is left holding a session on the console.
    return await Promise.race([work, ceiling]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Refusals that will not change by asking again in a few seconds.
 *
 * Only one: an unpaired console will not pair itself, and asking again is
 * pointless.
 *
 * "Already in use" was on this list, and it has been taken off. It DOES stick
 * when something really holds the console — three minutes of silence did not
 * shift it — but with the socket now closed politely it has also been seen to
 * clear on the very next attempt. Eight seconds of asking again is a cheap
 * price for the times it is the second kind, and when it is the first kind the
 * operator gets the same message eight seconds later.
 *
 * A console that cannot be FOUND is the other one on the list, and it is there
 * for the opposite reason: asking again is not cheap. Each retry waits out a
 * full discovery, and the console being absent is exactly the case where every
 * one of them will. The monitor re-reads the console every one and a half to
 * ten seconds and re-issues from what it actually sees, so a fast honest "not
 * there" loses nothing and returns the console to the panel's control at once.
 */
export const isPermanentRefusal = (code: PairResult["code"]): boolean =>
  code === "REJECTED" || code === "UNREACHABLE";

/**
 * Hang up on the console rather than pulling the wire out.
 *
 * The library's close destroys the socket, which is a reset — the console never
 * sees the connection end, so it goes on holding the session. Reproduced on a
 * real console: one successful sleep, and every later attempt was refused as
 * "already in use" until the console was restarted.
 *
 * A half-close first lets the console read the end of the stream and tear the
 * session down itself; the destroy that follows is then only cleaning up our
 * own side. Written defensively because it reaches past the library's public
 * shape: if any of it is missing, the ordinary close still happens.
 */
const endGracefully = async (connection: unknown): Promise<void> => {
  try {
    const stream = (connection as { socket?: { stream?: { end?: (cb?: () => void) => void } } })
      .socket?.stream;

    const end = stream?.end;
    if (typeof end === "function") {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        // A console that has just been told to sleep may never answer, so the
        // goodbye is bounded rather than waited on.
        setTimeout(finish, 2_000);
        end.call(stream, finish);
      });
    }
  } catch {
    // Reaching past a library's shape is allowed to fail; the close below is
    // what has to happen either way.
  }

  await (connection as { close: () => Promise<void> }).close().catch(() => {});
};

/**
 * @param hostId  The console's own `host-id`, when the caller knows it. An
 *   address is a DHCP lease: with several consoles in a venue the one at
 *   192.168.1.35 a moment ago may not be the one there now, and putting the
 *   WRONG console to sleep is the failure this parameter exists to prevent.
 *   Waking has always been identity-safe (the key is looked up by host-id);
 *   this is resting catching up.
 */
/**
 * Which discovered console this command is for.
 *
 * Identity first, address only as the fallback for a caller that has none.
 * `id` on a discovered device IS the host-id — the same value the place is
 * bound to and the wake key is filed under. An address is a DHCP lease: with
 * several consoles in a venue, the one at 192.168.1.35 a moment ago may not be
 * the one there now, and putting the WRONG console to sleep is the failure this
 * exists to prevent.
 */
export const isTheConsole = (
  address: string,
  hostId?: string,
): ((found: { id?: string; address?: { address?: string } }) => boolean) =>
  (found) => (hostId ? found.id === hostId : found.address?.address === address);

/** What {@link standby} answers when the caller withdrew the request before the next attempt. */
export const STANDBY_CANCELLED: PairResult = { ok: false, code: "CANCELLED", detail: "Superseded before the next attempt" };

/**
 * @param cancelled  Asked before every attempt, the first included. A session
 *   started on this console while the rest was still being retried has made the
 *   rest wrong: the console must not be put to sleep under the player who was
 *   just given it. An attempt already on the wire cannot be called back — the
 *   console may still sleep, and the panel wakes it from what it then observes.
 */
export const standby = async (
  address: string,
  keys: WakeKeys,
  hostId?: string,
  cancelled: () => boolean = () => false,
  attemptOnce: typeof standbyOnce = standbyOnce,
): Promise<PairResult> => {
  const startedAt = Date.now();
  let last: PairResult = { ok: false, code: "FAILED" };

  for (let attempt = 1; attempt <= STANDBY_ATTEMPTS; attempt++) {
    if (cancelled()) return STANDBY_CANCELLED;

    const left = STANDBY_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (left <= 0) return last;

    // Once this attempt is left behind — it timed out, or the rest was
    // withdrawn — it may still be opening its connection, and playactor cannot
    // be called back. What it can no longer do is send the standby: it asks
    // `gone` at the last moment, so a console never falls asleep after the
    // panel has given up on putting it to sleep (measured: 12 s later, under
    // whatever came next).
    const gone = { value: false };
    const watch = { done: false };
    last = await Promise.race([
      withCeiling(
        attemptOnce(address, keys, hostId, () => gone.value || cancelled()),
        Math.min(STANDBY_ATTEMPT_TIMEOUT_MS, left),
      ),
      // A withdrawal answers at once instead of after the slow connection, so
      // the wake the panel holds back until this returns goes out promptly.
      whenWithdrawn(cancelled, watch),
    ]);
    watch.done = true;
    gone.value = true;
    if (last.code === "CANCELLED") return last;
    if (last.ok || isPermanentRefusal(last.code)) return last;

    if (attempt < STANDBY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, STANDBY_RETRY_MS));
    }
  }

  return last;
};

/** Resolves as CANCELLED once `cancelled` turns true, unless `watch.done` first. */
const whenWithdrawn = (cancelled: () => boolean, watch: { done: boolean }): Promise<PairResult> =>
  new Promise((resolve) => {
    const timer = setInterval(() => {
      if (watch.done) { clearInterval(timer); return; }
      if (cancelled()) { clearInterval(timer); resolve(STANDBY_CANCELLED); }
    }, CANCEL_POLL_MS);
  });

/** One attempt: open the session, ask, and close whatever happened. */
const standbyOnce = async (
  address: string,
  keys: WakeKeys,
  hostId?: string,
  cancelled: () => boolean = () => false,
): Promise<PairResult> => {
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
      hostId ? `console ${hostId}` : `console at ${address}`,
      isTheConsole(address, hostId),
      undefined,
      aimedAt(address),
      undefined,
      manager,
    );

    // playactor WAKES a console before it connects (ResolvedDevice.openConnection
    // → waker.wake, unconditionally). Asked to sleep a console that is already
    // asleep — another panel got there first, or this is a retry after it went
    // down — it woke it to put it back to sleep: measured 2026-10-28, two
    // panels, the console woke twice after its session had ended. Its own
    // discovery answer says whether it sleeps; a sleeping one is left alone.
    const found = await device.discover();
    if (found.status === "STANDBY") return { ok: true, detail: "Already in rest mode" };
    if (cancelled()) return STANDBY_CANCELLED;

    const connection = await device.openConnection();
    try {
      // Withdrawn (a session started) or abandoned (timed out) while the
      // connection was being opened: the last moment the standby can still not
      // be sent. Without it a late connection slept the console under the
      // next player.
      if (cancelled()) return STANDBY_CANCELLED;
      await connection.standby();
    } finally {
      // Always, even when the request above threw. A session left open is one
      // the console goes on holding, and the next attempt is then refused with
      // "already in use" — by us, against ourselves.
      await endGracefully(connection);
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
