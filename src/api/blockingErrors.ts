import type { ApiError } from "@/api/client";

/**
 * Turns the server's "you are blocked" refusal into a sentence in the
 * operator's own language.
 *
 * The API answers every administrative block with a stable `code` beside its
 * message — `company_blocked`, `branch_blocked`, `branch_operation_blocked`.
 * The panel renders its OWN wording from that code, which is the only way the
 * sentence is guaranteed to match the language the rest of the screen is in:
 * the message travels with whatever locale the request negotiated, and a
 * broadcast one (an eviction pushed over Reverb) has no request at all.
 *
 * The server's text is kept as the fallback, so a code shipped by a newer
 * backend than this panel still reads as something rather than nothing.
 */

/** Shape of the JSON body a blocked request answers with. */
export interface BlockedErrorBody {
  message?: string;
  code?: string;
  scope?: "company" | "branch";
  branch_id?: number;
}

/** Codes this panel has wording for. Anything else falls back to the server. */
const KNOWN = new Set([
  "company_blocked",
  "branch_blocked",
  "branch_operation_blocked",
]);

/**
 * The translation key for a block code, or null when it is not one of ours.
 * Callers pass it to `t()` — this module stays free of React and of the
 * language context.
 */
export const blockingKeyFor = (code: unknown): string | null =>
  typeof code === "string" && KNOWN.has(code) ? `blocking.reason.${code}` : null;

/** The block body of a failed request, or null if it was not a block. */
export const blockedBodyOf = (error: unknown): BlockedErrorBody | null => {
  const body = (error as ApiError | undefined)?.body;
  if (!body || typeof body !== "object") return null;

  const candidate = body as BlockedErrorBody;
  return blockingKeyFor(candidate.code) ? candidate : null;
};

/**
 * The translation key for a failed request that was refused by a block, or
 * null when it was refused for any other reason.
 *
 * Callers that RENDER (a screen holding the error in state) want the key, so
 * the sentence follows a later language change; callers that FIRE AND FORGET
 * (a toast) want {@link blockingMessage} instead.
 */
export const blockingKeyOf = (error: unknown): string | null => {
  const body = blockedBodyOf(error);
  return body ? blockingKeyFor(body.code) : null;
};

/**
 * The sentence to show for a failed request: the panel's own wording when the
 * refusal is a known block, otherwise whatever the caller would have shown.
 *
 * @param translate the active `t` — passed in rather than imported so this
 *                  works from components and from plain functions alike.
 */
export const blockingMessage = (
  error: unknown,
  translate: (key: string) => string,
): string | null => {
  const body = blockedBodyOf(error);
  if (!body) return null;

  const key = blockingKeyFor(body.code);
  return key ? translate(key) : (body.message ?? null);
};
