import { createSocket } from "node:dgram";
import { PS_DISCOVERY_PORT } from "./protocol";

/**
 * Waking a PlayStation out of rest mode.
 *
 * One UDP datagram to the same port discovery uses, and the console is awake
 * in a few seconds. The catch is the credential: the packet is authenticated,
 * and a console ignores a `WAKEUP` that does not carry the key it issued when
 * it was paired with an account. There is no way around that and none is
 * wanted — it is the thing stopping the neighbours from switching on a venue's
 * consoles.
 *
 * ## Where the key comes from
 * From the console itself, once, through Sony's own pairing: the owner links a
 * PSN account to the console (Settings → System → Remote Play → Link Device)
 * with an official Remote Play client, and that client is handed a registration
 * key. We ask the owner to paste that key in; we do not perform the pairing
 * handshake ourselves. That handshake needs key material extracted from Sony's
 * client, and shipping that inside a commercial product is not a thing to do
 * casually — while the datagram below is just a documented packet with the
 * owner's own key in it.
 *
 * ## What this can and cannot tell you
 * UDP has no answer. A send that succeeds means the datagram left this machine,
 * nothing more — not that the console heard it, and not that it woke. The
 * console's actual state comes back the way it always does, from the next
 * discovery probe, which is why the board keeps checking every ten seconds.
 */

/**
 * The credential a console will accept, from the key its owner was given.
 *
 * The key is up to eight hex characters and travels in the packet as the
 * unsigned integer they spell. Anything longer, or anything that is not hex, is
 * not a registration key — refusing it here means the operator gets told so
 * instead of watching a console quietly ignore every wake.
 */
export const credentialFromRegistKey = (registKey: string): bigint | null => {
  const key = registKey.trim();
  if (!/^[0-9a-fA-F]{1,8}$/.test(key)) return null;

  return BigInt(`0x${key}`);
};

/**
 * The wake datagram, byte for byte as a console expects it.
 *
 * The header set is not decorative — a console checks it and drops a packet
 * that is shaped differently. `\n` line endings, not `\r\n`, and a trailing
 * newline on the last header.
 */
export const wakePacket = (credential: bigint): Buffer =>
  Buffer.from(
    "WAKEUP * HTTP/1.1\n" +
    "client-type:vr\n" +
    "auth-type:R\n" +
    "model:w\n" +
    "app-type:r\n" +
    `user-credential:${credential.toString(10)}\n` +
    "device-discovery-protocol-version:00030010\n",
    "utf8",
  );

/**
 * Send a wake carrying a credential that is already a credential.
 *
 * Pairing produces the finished value; a key typed in by hand still has to be
 * converted. Keeping the two entry points apart is what stops one being fed to
 * the other, which produces a datagram the console ignores without a word.
 */
export const wakeWithCredential = async (address: string, credential: string | null): Promise<WakeResult> => {
  if (!credential) return { sent: false, reason: "no-credential" };
  if (!/^\d+$/.test(credential.trim())) return { sent: false, reason: "bad-credential" };

  return send(address, BigInt(credential.trim()));
};

export interface WakeResult {
  /** The datagram left this machine. Says nothing about the console. */
  sent: boolean;
  /** Why not, when it did not. Never contains the key. */
  reason?: "no-credential" | "bad-credential" | "send-failed";
  detail?: string;
}

/**
 * Send one wake datagram to a console at `address`.
 *
 * @param registKey  The key from pairing. Never logged, never returned.
 */
export const wake = async (address: string, registKey: string | null): Promise<WakeResult> => {
  if (!registKey) return { sent: false, reason: "no-credential" };

  const credential = credentialFromRegistKey(registKey);
  if (credential === null) return { sent: false, reason: "bad-credential" };

  return send(address, credential);
};

/** The datagram itself, once there is a credential to put in it. */
const send = async (address: string, credential: bigint): Promise<WakeResult> => {
  const socket = createSocket({ type: "udp4" });

  return new Promise<WakeResult>((resolve) => {
    let settled = false;
    const finish = (result: WakeResult) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* already closed */ }
      resolve(result);
    };

    socket.on("error", (error: Error) => finish({ sent: false, reason: "send-failed", detail: error.message }));

    socket.send(wakePacket(credential), PS_DISCOVERY_PORT, address, (error) => {
      // The error message can name the address and the port, never the packet
      // — the packet has the key in it.
      finish(error ? { sent: false, reason: "send-failed", detail: error.message } : { sent: true });
    });
  });
};
