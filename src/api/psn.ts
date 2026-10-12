import { request } from "./client";

/**
 * The company's PSN sender (2026-10-12): the PlayStation account the "your
 * session ends in 15 minutes" message reaches a PlayStation player from.
 *
 * The server never hands a token back; this is all a panel ever learns.
 */
export interface IPsnSender {
  connected: boolean;
  /** The sender's PSN name, when Sony told us. */
  online_id: string | null;
  /** When the sign-in lapses and the owner must connect again (about two months). */
  expires_at: string | null;
  /** The last refusal: sign_in | no_such_player | refused | unavailable. */
  last_error: string | null;
  last_error_at: string | null;
  last_sent_at: string | null;
}

export const apiGetPsnSender = (companyId: number) =>
  request<{ data: IPsnSender }>(`/companies/${companyId}/psn-sender`);

/** `npsso`: the cookie Sony shows at {@link PSN_NPSSO_URL} to a browser signed in to PlayStation. */
export const apiConnectPsnSender = (companyId: number, npsso: string) =>
  request<{ data: IPsnSender }>(`/companies/${companyId}/psn-sender`, { method: "PUT", body: { npsso } });

export const apiDisconnectPsnSender = (companyId: number) =>
  request<{ data: IPsnSender }>(`/companies/${companyId}/psn-sender`, { method: "DELETE" });

/** Where a signed-in browser reads its `npsso`. Opened in the system browser. */
export const PSN_NPSSO_URL = "https://ca.account.sony.com/api/v1/ssocookie";

/**
 * Where the owner signs in: Sony's own account site, in the system browser.
 * It signs in on ca.account.sony.com, the domain {@link PSN_NPSSO_URL} reads the
 * cookie from. (playstation.com redirected Armenia to /en-am/, which is a 404.)
 */
export const PSN_SIGN_IN_URL = "https://my.account.sony.com/";

/** A PSN online ID: 3-16 characters, a letter first, then letters, digits, - and _. Mirrors the server. */
export const PSN_ONLINE_ID = /^[A-Za-z][A-Za-z0-9_-]{2,15}$/;

/**
 * The npsso out of whatever was pasted: the bare 64 characters, or the whole
 * `{"npsso":"..."}` the page shows. Null when there is no such value in it.
 */
export const npssoOf = (pasted: string): string | null => {
  const text = pasted.trim();
  const match = /"npsso"\s*:\s*"([A-Za-z0-9]{64})"/.exec(text) ?? /^([A-Za-z0-9]{64})$/.exec(text);
  return match ? match[1] : null;
};
