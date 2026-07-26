import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";

/**
 * Namespace a preference key with the signed-in account, so two staff
 * members sharing one machine never inherit each other's arrangement:
 * what the owner drags must stay invisible to the manager who logs in
 * after him. Signed-out (no account yet) falls back to `anon`.
 */
const scopeKey = (storageKey: string, userId: number | undefined): string =>
  `u${userId ?? "anon"}:${storageKey}`;

const read = (storageKey: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export interface LocalReorder {
  /** Live keys in the user's saved order (new keys appended, removed dropped). */
  ordered: string[];
  /** Move `fromKey` to sit just before `beforeKey` (or to the end when null). */
  move: (fromKey: string, beforeKey: string | null) => void;
}

/**
 * Per-USER manual ordering for a list of stable string keys, persisted in
 * localStorage under `storageKey` namespaced by the signed-in account. On
 * every render the saved order is reconciled with the live `keys`: known keys
 * keep their saved position, brand new keys are appended, removed keys drop
 * out. Pure client-side (no backend) — a reusable primitive for any
 * drag-reorderable list (board sections, hub tiles, place tiles, …).
 *
 * Order is a personal UI preference, never shared venue state: an owner who
 * re-arranges his hub must not re-arrange the hub of the manager who logs in
 * on the same machine afterwards. The account scoping lives HERE so every
 * call site inherits it — see {@link scopeKey}. (Server-persisted orders do
 * the same per user, e.g. `POST /pcs/reorder`.)
 */
export function useLocalReorder(storageKey: string, keys: string[]): LocalReorder {
  const { user } = useAuth();
  const scopedKey = scopeKey(storageKey, user?.id);
  // The saved order is stored TOGETHER with the key it was loaded from, so a
  // key change (other account, other branch) can never persist the previous
  // owner's arrangement under the new key during the re-hydrate render.
  const [state, setState] = useState<{ key: string; order: string[] }>(() => ({
    key: scopedKey,
    order: read(scopedKey),
  }));

  // Re-hydrate when the target list changes (e.g. switching branch or
  // account → new key).
  useEffect(() => {
    setState((prev) => (prev.key === scopedKey ? prev : { key: scopedKey, order: read(scopedKey) }));
  }, [scopedKey]);

  // Persist whenever the saved order changes — but only once the state
  // actually belongs to the current key (see above).
  useEffect(() => {
    if (state.key !== scopedKey) return;
    try {
      localStorage.setItem(scopedKey, JSON.stringify(state.order));
    } catch {
      /* private mode / quota — ordering just falls back to default */
    }
  }, [scopedKey, state]);

  // Effective order: saved keys still present (in saved order), then any keys
  // not yet known, appended in their natural order. While a key change is
  // in flight the stale order is ignored, so nothing of the previous account
  // is ever rendered.
  const saved = state.key === scopedKey ? state.order : [];
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const k of saved) if (keys.includes(k) && !seen.has(k)) { ordered.push(k); seen.add(k); }
  for (const k of keys) if (!seen.has(k)) { ordered.push(k); seen.add(k); }

  const move = (fromKey: string, beforeKey: string | null) => {
    if (fromKey === beforeKey) return;
    const next = ordered.filter((k) => k !== fromKey);
    if (beforeKey == null || !next.includes(beforeKey)) {
      next.push(fromKey);
    } else {
      next.splice(next.indexOf(beforeKey), 0, fromKey);
    }
    setState({ key: scopedKey, order: next });
  };

  return { ordered, move };
}
