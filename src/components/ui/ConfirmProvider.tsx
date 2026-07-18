import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Promise-based confirm, backed by the in-app {@link ConfirmDialog}.
 *
 * Native `window.confirm()` / `window.alert()` POISON the Electron renderer's
 * keyboard focus: after one fires, the next modal's inputs silently refuse
 * keystrokes until the window is re-focused. Routing every confirmation
 * through a React dialog removes the native call entirely, so modal inputs
 * always accept typing.
 *
 * Usage:  const confirm = useConfirm();
 *         if (!(await confirm(t("pcs.confirmDelete")))) return;
 */
interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
type ConfirmFn = (message: string, opts?: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  open: boolean;
  message: string;
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<DialogState>({ open: false, message: "" });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, message, ...opts });
    });
  }, []);

  const settle = (value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
    resolve?.(value);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        destructive={state.destructive}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </Ctx.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
};
