/**
 * "This address may not use Cyber Place" — the administrator blocked the IP
 * address or the country this device connects from (2026-10-01).
 *
 * The backend refuses EVERY request from such an address with 403 and a code
 * (`ip_blocked`, `country_blocked`; NetworkAccessGuard). The API client raises
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

export type NetworkBlockCode = "ip_blocked" | "country_blocked";

const CODES: ReadonlySet<string> = new Set<NetworkBlockCode>(["ip_blocked", "country_blocked"]);

/** The block code of a refused response, or null when it is any other answer. */
export const networkBlockCodeOf = (status: number | undefined, body: unknown): NetworkBlockCode | null => {
  if (status !== 403 || !body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" && CODES.has(code) ? (code as NetworkBlockCode) : null;
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
