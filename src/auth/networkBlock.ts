/**
 * "This device may not use Cyber Place" (2026-10-01): the backend refuses
 * EVERY request from it with 403 and a code (NetworkAccessGuard) —
 * `access_blocked` (an administrator's rule) or `access_suspended` (the
 * system blocked it after suspicious requests). What exactly was blocked — an
 * address, a country — is never said to the person, here or by the server. The API client raises
 * it here; the app answers by replacing the whole interface with one screen
 * that says so ({@link ../components/NetworkBlockedScreen}), dropping cached
 * responses and the realtime socket — nothing from before the block stays
 * visible or keeps updating.
 *
 * The state is kept, not only announced: a block noticed during start-up —
 * before the screen that shows it is mounted — must still be shown. Nothing
 * here signs anybody out: the account did nothing wrong, the ADDRESS is
 * refused, and once the administrator lifts it a reload continues where the
 * person was.
 *
 * Framework-agnostic pub/sub, like {@link ./sessionExpiry}.
 */

/** Blocked by an administrator, or suspended by the system. */
export type NetworkBlockCode = "blocked" | "suspended";

const CODES: Readonly<Record<string, NetworkBlockCode>> = {
  access_blocked: "blocked",
  access_suspended: "suspended",
  // Sent by the backend of 2026-10-01 morning; still understood.
  ip_blocked: "blocked",
  country_blocked: "blocked",
};

/** The kind of block a refused response announces, or null when it is any other answer. */
export const networkBlockCodeOf = (status: number | undefined, body: unknown): NetworkBlockCode | null => {
  if (status !== 403 || !body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(CODES, code) ? CODES[code] : null;
};

/** Whether a thrown API error is an address block. */
export const isNetworkBlockError = (error: unknown): boolean => {
  const e = error as { status?: number; body?: unknown } | null;
  return networkBlockCodeOf(e?.status, e?.body) !== null;
};

type Listener = () => void;

let current: NetworkBlockCode | null = null;
const listeners = new Set<Listener>();

export const networkBlock = {
  /** The server refused this address. Idempotent: every in-flight request may report it. */
  raise: (code: NetworkBlockCode): void => {
    if (current === code) return;
    current = code;
    for (const l of listeners) {
      try { l(); } catch { /* a listener must not break the request that noticed the block */ }
    }
  },
  current: (): NetworkBlockCode | null => current,
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  /** Tests only: forget the state between cases. */
  resetForTests: (): void => { current = null; },
};
