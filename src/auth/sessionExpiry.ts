/**
 * "The server no longer accepts this session" — raised by the API client,
 * answered by the auth layer.
 *
 * The realtime path ({@link ../realtime/AccessGuard}) is what makes a block
 * land instantly, and it is the one that carries an explanation. This is the
 * floor underneath it: Reverb may be unconfigured, unreachable, or simply slow,
 * and a panel whose token was revoked must not be left in the state that
 * produces — signed in as far as the UI is concerned, refused by every request
 * it makes, showing the operator a screen of failures instead of a login form.
 *
 * A tiny framework-agnostic pub/sub, mirroring {@link ../ui/notify}: the client
 * has no React context to reach for, and threading one into it would couple a
 * plain fetch wrapper to the component tree.
 *
 * Deliberately narrow: raised ONLY for a 401 on a request that actually carried
 * a token. A 401 from a call made without credentials says nothing about the
 * session, and treating it as expiry would sign people out over an endpoint
 * they were never authenticated for.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const sessionExpiry = {
  /** The server rejected our token. Idempotent for the listener — it may fire several times as in-flight requests land. */
  raise: (): void => {
    for (const l of listeners) {
      // A throwing listener must not break the request that noticed the
      // expiry — that call already has its own error to report.
      try { l(); } catch { /* ignore */ }
    }
  },
  /** Subscribe; returns an unsubscribe fn. */
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
