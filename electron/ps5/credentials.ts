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
 *    storing is refused outright rather than quietly falling back to a file
 *    anyone can read.
 *  - **It never reaches a log.** Nothing here formats the key into a message,
 *    and the callers say "no credential", never which one.
 *
 * Keys are per machine, not per company: this is the one piece that cannot come
 * down from the server, because the server would then hold every venue's
 * console keys in one place.
 */

/** hostId → the OS-encrypted key, base64 for JSON. */
type Vault = Record<string, string>;

export class WakeKeys {
  private vault: Vault = {};

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
    return typeof this.vault[hostId] === "string" && this.vault[hostId].length > 0;
  }

  /** @returns false when the OS has no keystore — the key is then NOT stored. */
  async set(hostId: string, registKey: string): Promise<boolean> {
    if (!this.available()) return false;

    this.vault[hostId] = safeStorage.encryptString(registKey).toString("base64");
    await this.flush();
    return true;
  }

  async forget(hostId: string): Promise<void> {
    delete this.vault[hostId];
    await this.flush();
  }

  /**
   * The plaintext key, for building one datagram.
   *
   * Deliberately not exposed over IPC — the only caller is the wake handler in
   * the main process, a few lines away from the socket.
   */
  read(hostId: string): string | null {
    const stored = this.vault[hostId];
    if (!stored) return null;

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
