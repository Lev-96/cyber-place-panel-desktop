import { apiCache } from "@/api/client";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import { accessVersion } from "@/realtime/accessVersion";
import { getEcho } from "@/realtime/echo";
import { useEffect } from "react";

/**
 * Keeps this panel honest about which venues are open when the block came from
 * SOMEWHERE ELSE.
 *
 * {@link AccessGuard} covers the account's own channel: it hears a block aimed
 * at this person and acts on it. Nothing covered the other case — a second
 * administrator, on a second machine, closing a company while this panel has
 * the branch list, the branch page or the company list open. Those screens keep
 * describing the previous state until somebody reloads by hand, and the state
 * they describe is the one an operator makes decisions from.
 *
 * The signal is the same one the mobile catalogue listens to
 * (`App\Events\BranchVisibilityChanged` on the public `branches` channel) — one
 * event, both audiences, so the two clients can never disagree about which
 * venues are open. It carries branch ids and nothing else, which is what makes
 * a public channel acceptable for it.
 *
 * The reaction is deliberately the dumbest possible one: drop the response
 * cache (its entries were recorded under the previous state) and bump
 * {@link accessVersion}, which every screen showing block state already watches.
 * No screen learns a new concept, and nothing here decides what a block means —
 * the re-read asks the server, which is the only place that knows whether a
 * branch is closed in its own right or through its company.
 *
 * Mounted alongside AccessGuard inside the authed tree; renders nothing.
 */
const BranchVisibilityGuard = () => {
  // Re-attaches when the Echo client is rebuilt on connection details the
  // backend handed us: a subscription on the discarded client is silent.
  const realtime = useRealtimeVersion();

  useEffect(() => {
    const echo = getEcho();
    // Reverb unconfigured or unreachable: screens keep their existing refresh
    // paths (navigation, manual reload). Nothing here is load-bearing for
    // correctness — the server refuses writes into a blocked branch either way.
    if (!echo) return;

    // Channel and event names are written out rather than built from
    // constants: `broadcastContract.test.ts` reads these literals out of the
    // source and compares them to what the backend publishes, and that check
    // is the only thing standing between a renamed event and a subscription
    // that silently never fires.
    const channel = echo.channel("branches");
    const listener = () => {
      apiCache.clear();
      accessVersion.bump();
    };

    channel.listen(".branch.visibility.changed", listener);
    return () => {
      channel.stopListening(".branch.visibility.changed", listener);
    };
  }, [realtime]);

  return null;
};

export default BranchVisibilityGuard;
