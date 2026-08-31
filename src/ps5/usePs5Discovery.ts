import { useCallback, useState } from "react";

/**
 * Ask this machine what PlayStations it can see.
 *
 * The work happens in Electron's main process — the renderer has no sockets —
 * so this is a thin wrapper over one IPC call, with the three states a screen
 * actually needs: idle, searching, and a result that may legitimately be empty.
 *
 * `available` is false in a browser and against an older preload. A screen must
 * check it and say so rather than offering a button that cannot work.
 */

export type Ps5State = "awake" | "rest" | "unreachable" | "unknown";

export interface Ps5Console {
  hostId: string;
  name: string;
  type: string;
  address: string;
  state: Ps5State;
  systemVersion: string | null;
}

export interface Ps5SweepResult {
  consoles: Ps5Console[];
  probed: string[];
  warnings: string[];
}

export interface WakeOutcome {
  /** A datagram left this machine. UDP has no answer, so that is all it means. */
  sent: boolean;
  reason?: "no-credential" | "bad-credential" | "send-failed" | "bad-request";
  /** Machine-readable failure, as the transport names it. */
  code?: string;
  detail?: string;
}

export interface CredentialState {
  /** Whether this console has a wake key stored on THIS machine. */
  has: boolean;
  /** Whether the OS offers a keystore at all. False means a key cannot be stored. */
  available: boolean;
}

export interface Ps5Bridge {
  /** Shout at the whole network. Behind a button — never on a timer. */
  discover: (timeoutMs?: number) => Promise<Ps5SweepResult>;
  /**
   * Ask named addresses directly. Optional: a panel running against an older
   * preload has `discover` and not this, and the caller must cope rather than
   * throw.
   */
  probe?: (addresses: string[], timeoutMs?: number) => Promise<Ps5SweepResult>;
  /**
   * Wake a console out of rest. The key stays in the main process: this side
   * names a console and learns whether a datagram went out — never the key,
   * and never whether the console actually woke. That answer comes back from
   * the next status probe, like every other fact about a console.
   */
  wake?: (hostId: string, address: string) => Promise<WakeOutcome>;
  /**
   * Ask a console to go to rest.
   *
   * Optional, and today's transport answers `UNSUPPORTED_BY_TRANSPORT`: the
   * local protocol has no rest command — that needs a Remote Play session. The
   * method exists so every layer above is written against the real shape, and
   * so the refusal is a value the screen can show rather than a missing
   * function nobody handles.
   */
  rest?: (hostId: string, address: string) => Promise<WakeOutcome>;
  /**
   * Try a key once, without storing it. For checking a key that was just handed
   * over, and for machines whose OS offers no keystore at all.
   */
  wakeOnce?: (address: string, registKey: string) => Promise<WakeOutcome>;
  /** Write a wake key. There is deliberately no reader. */
  setCredential?: (hostId: string, registKey: string) => Promise<{ saved: boolean; reason?: string }>;
  hasCredential?: (hostId: string) => Promise<CredentialState>;
  forgetCredential?: (hostId: string) => Promise<{ ok: boolean }>;
}

export const ps5Bridge = (): Ps5Bridge | null =>
  (globalThis as unknown as { cyberplacePS5?: Ps5Bridge }).cyberplacePS5 ?? null;

const bridge = ps5Bridge;

export const ps5DiscoveryAvailable = (): boolean => bridge() !== null;

export const usePs5Discovery = () => {
  const [consoles, setConsoles] = useState<Ps5Console[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Where the probe went — the only way to diagnose a network that answers nothing. */
  const [probed, setProbed] = useState<string[]>([]);

  const scan = useCallback(async () => {
    const api = bridge();
    if (!api) {
      setError("unavailable");
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const result = await api.discover(2_000);
      setConsoles(result.consoles);
      setProbed(result.probed);
    } catch (e) {
      // A failed sweep leaves the previous list alone: a network hiccup should
      // not erase what the owner was just looking at.
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setSearching(false);
    }
  }, []);

  return { consoles, searching, error, probed, scan };
};
