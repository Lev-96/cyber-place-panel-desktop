/**
 * "Your company's access is closed for an unpaid Cyber Place Platform bill"
 * (owner, 2026-11-09). The server answers a sign-in, or any request, of such a
 * company's staff with 403 and `code: company_billing_blocked`, and signs the
 * ones already in out (`access.changed`, once no session is running there).
 * The API client and the access guard raise it here; the app answers with one
 * plain screen that says why and whom to call
 * ({@link ../components/BillingBlockedModal}). Kept until dismissed, so a
 * refusal noticed before that screen is mounted is still shown.
 *
 * Framework-agnostic pub/sub, like {@link ./networkBlock}. Nothing else: the
 * kiosk and network locks have their own codes and stores.
 */

export const BILLING_BLOCK_CODE = "company_billing_blocked";

/** Whether a refused response (status + JSON body) is the billing block. */
export const isBillingBlockBody = (status: number | undefined, body: unknown): boolean =>
  status === 403 && !!body && typeof body === "object" && (body as { code?: unknown }).code === BILLING_BLOCK_CODE;

type Listener = () => void;

let shown = false;
const listeners = new Set<Listener>();
const notify = () => {
  for (const l of listeners) {
    try { l(); } catch { /* a listener must not break the request that noticed it */ }
  }
};

export const billingBlock = {
  /** Show the screen. Idempotent: every refused request may report it. */
  raise: (): void => {
    if (shown) return;
    shown = true;
    notify();
  },
  /** The person read it. */
  dismiss: (): void => {
    if (!shown) return;
    shown = false;
    notify();
  },
  isShown: (): boolean => shown,
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
