import { promises as fs } from "node:fs";
import { safeStorage } from "electron";

/**
 * Where a console's wake key lives on this machine.
 *
 * The key is the one secret this feature has: whoever holds it can switch that
 * console on from anywhere on the venue's network. So it is encrypted by the
 * operating system's own keystore — DPAPI on Windows, the login keyring on
 * Linux, the Keychain on macOS — and the plaintext exists only inside this
 * process, for the microseconds it takes to build a datagram.
 *
 * Three rules, and they are the whole design:
 *
 *  - **It never crosses to the renderer.** The bridge can be asked *whether* a
 *    console has a key, never what it is. A secret that reaches a web page is a
 *    secret in the devtools of anyone who opens them.
 *  - **It is never written in the clear.** If the OS has no keystore to offer,
 *    nothing is written to disk at all. The key is kept in this process's
 *    memory for as long as the panel runs and is gone when it closes — which
 *    is worse for the operator than a saved key and better than a file anyone
 *    with the machine can read. The screen says which of the two happened.
 *  - **It never reaches a log.** Nothing here formats the key into a message,
 *    and the callers say "no credential", never which one.
 *
 * Keys are per machine, not per company: this is the one piece that cannot come
 * down from the server, because the server would then hold every venue's
 * console keys in one place.
 */

/** hostId → the OS-encrypted key, base64 for JSON. */
type Vault = Record<string, string>;

export interface SaveOutcome {
  saved: boolean;
  /** False when the key lives only until the panel closes. */
  persisted: boolean;
}

export class WakeKeys {
  private vault: Vault = {};
  /**
   * Keys held only for this run, on a machine whose OS offers no keystore.
   *
   * Never written anywhere. The alternative — refusing outright — is what made
   * the feature unusable on such a machine: a session could not wake anything,
   * and the operator was given no way to change that.
   */
  private readonly session = new Map<string, string>();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      this.vault = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Vault;
    } catch {
      // No file yet, or a corrupted one. Either way the safe reading is "no
      // keys" — a console simply asks to be paired again.
      this.vault = {};
    }
  }

  /**
   * Whether the OS will actually encrypt for us.
   *
   * On a desktop with no keyring — a bare Linux box, a locked-down profile —
   * Electron falls back to storing readable text. That is exactly what must not
   * happen with this, so the answer is surfaced and storing is refused.
   */
  available(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  has(hostId: string): boolean {
    return this.holds(hostId) || this.holds(`cred:${hostId}`);
  }

  /** Whether one slot holds something, saved or held for the run. */
  private holds(slot: string): boolean {
    return (typeof this.vault[slot] === "string" && this.vault[slot].length > 0)
      || this.session.has(slot);
  }

  /** Whether what we hold for this console survives a restart. */
  isPersisted(hostId: string): boolean {
    return (typeof this.vault[hostId] === "string" && this.vault[hostId].length > 0)
      || (typeof this.vault[`cred:${hostId}`] === "string" && this.vault[`cred:${hostId}`].length > 0);
  }

  async set(hostId: string, registKey: string): Promise<SaveOutcome> {
    if (!this.available()) {
      // Nothing reaches the disk. It works until the panel closes, and the
      // screen says so rather than implying it was saved.
      this.session.set(hostId, registKey);
      return { saved: true, persisted: false };
    }

    this.vault[hostId] = safeStorage.encryptString(registKey).toString("base64");
    await this.flush();
    return { saved: true, persisted: true };
  }

  async forget(hostId: string): Promise<void> {
    // Everything about this console goes: the typed key, the credential pairing
    // produced, and the pairing itself. A half-forgotten console is one that
    // still answers to somebody.
    for (const slot of [hostId, `cred:${hostId}`, `creds:${hostId}`]) {
      delete this.vault[slot];
      this.session.delete(slot);
    }
    await this.flush();
  }

  /**
   * The wake credential, as pairing produced it.
   *
   * Kept apart from the registration key an owner can type in, because they are
   * NOT the same value: a key is hex the console issued, the credential is the
   * number that hex spells. Storing one where the other is expected would send
   * a wake the console silently ignores — which is exactly the failure this
   * feature spent a day chasing.
   */
  async setWakeCredential(deviceId: string, credential: string): Promise<void> {
    await this.set(`cred:${deviceId}`, credential);
  }

  /** The credential a wake datagram should carry, whichever route provided it. */
  readWakeCredential(deviceId: string): string | null {
    return this.read(`cred:${deviceId}`);
  }

  hasWakeCredential(deviceId: string): boolean {
    return this.has(`cred:${deviceId}`);
  }

  /**
   * Pairing credentials for a console, as playactor produced them.
   *
   * Kept in the same vault and under the same rules as the wake key: encrypted
   * by the OS where it can, held only for the run where it cannot, and never
   * readable from the renderer. They include the console's registration key,
   * which is what lets anyone on the network switch it on — so a JSON file in
   * the home directory, which is what the library would write by itself, is not
   * where they go.
   */
  readCredentials(deviceId: string): string | null {
    return this.read(`creds:${deviceId}`);
  }

  async setCredentials(deviceId: string, json: string): Promise<void> {
    await this.set(`creds:${deviceId}`, json);
  }

  hasCredentials(deviceId: string): boolean {
    return this.has(`creds:${deviceId}`);
  }

  async forgetCredentials(deviceId: string): Promise<void> {
    await this.forget(`creds:${deviceId}`);
  }

  /**
   * The plaintext key, for building one datagram.
   *
   * Deliberately not exposed over IPC — the only caller is the wake handler in
   * the main process, a few lines away from the socket.
   */
  read(hostId: string): string | null {
    const stored = this.vault[hostId];
    if (!stored) return this.session.get(hostId) ?? null;

    try {
      return safeStorage.decryptString(Buffer.from(stored, "base64"));
    } catch {
      // Written by another OS user, or after a keystore reset. Unreadable is
      // the same as absent, and the operator is asked to pair again.
      return null;
    }
  }

  private async flush(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.vault), { encoding: "utf8", mode: 0o600 });
  }
}
