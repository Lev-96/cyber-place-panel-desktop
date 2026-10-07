/**
 * The one-time pass a solved sign-in mosaic earns (2026-10-01, shared by the
 * desktop and the owner web since 2026-10-07). The next sign-in attempt
 * carries it once; it is never stored anywhere but in memory, and the
 * server, not this, decides whether it counts.
 */
let pending: string | null = null;

export const loginChallenge = {
  set(token: string): void {
    pending = token;
  },
  /** The pass, once: reading it clears it. */
  take(): string | null {
    const token = pending;
    pending = null;
    return token;
  },
};
