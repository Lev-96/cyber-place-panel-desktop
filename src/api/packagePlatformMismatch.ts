import type { ApiError } from "@/api/client";

/**
 * "This tariff is for another platform."
 *
 * Starting or extending a session with a time package that targets a
 * different platform than the seat's is refused with a 422 and a stable
 * `code: "package_platform_mismatch"`. The panel words it in the operator's
 * own language from the code; the server's sentence is only what a build
 * that does not know the code would have shown anyway.
 *
 * Shaped after `seatUnavailable.ts` / `blockingErrors.ts`.
 */

export const PACKAGE_PLATFORM_MISMATCH_CODE = "package_platform_mismatch";

/** True when a failed start/extend was refused for a package of another platform. */
export const packageMismatchOf = (error: unknown): boolean => {
  const body = (error as ApiError | undefined)?.body;
  return !!body && typeof body === "object"
    && (body as { code?: unknown }).code === PACKAGE_PLATFORM_MISMATCH_CODE;
};
