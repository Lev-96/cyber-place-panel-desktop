/**
 * App-wide toast notifications for create / update / delete outcomes.
 *
 * A tiny framework-agnostic pub/sub so ANY layer (repositories, forms,
 * plain functions) can raise a toast without threading React context
 * through the call site. The single <Toaster/> mounted at the app root
 * subscribes and renders. Messages are resolved to the active language
 * inside the Toaster (which has `t()`), so callers only pass a stable
 * `entity` + `action` descriptor — never a hard-coded string.
 */

export type ToastKind = "success" | "error";

export interface ToastEvent {
  id: number;
  kind: ToastKind;
  /** Stable entity key, e.g. "place", "pc", "member", "company". */
  entity?: string;
  /** Stable action key, e.g. "created", "updated", "deleted". */
  action?: string;
  /** Pre-resolved raw text — used when the caller has its own message. */
  text?: string;
}

type Listener = (e: ToastEvent) => void;

const listeners = new Set<Listener>();
let seq = 0;

const dispatch = (event: ToastEvent): void => {
  // A throwing listener (e.g. mid-unmount) must never break the caller
  // that raised the toast — the mutation itself already succeeded.
  for (const l of listeners) {
    try { l(event); } catch { /* ignore */ }
  }
};

export const notify = {
  success: (entity: string, action: string): void =>
    dispatch({ id: ++seq, kind: "success", entity, action }),
  error: (entity: string, action: string): void =>
    dispatch({ id: ++seq, kind: "error", entity, action }),
  /** Raw-text toast — used to replace native alert() calls. */
  message: (kind: ToastKind, text: string): void =>
    dispatch({ id: ++seq, kind, text }),
  /** Subscribe; returns an unsubscribe fn. */
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

/**
 * Wrap a mutation so a green success toast fires on success and a red
 * error toast on failure. Re-throws on error, so a form's existing inline
 * error handling keeps working unchanged — the toast is purely additive.
 */
export const withToast = async <T>(
  entity: string,
  action: string,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await fn();
    notify.success(entity, action);
    return result;
  } catch (e) {
    notify.error(entity, action);
    throw e;
  }
};
