import { ApiError } from "@/api/client";

type Translate = (key: string) => string;

/**
 * Localised message for an API error. The backend has no ru/am translations,
 * so specific errors are localised on the client by a stable `error` CODE
 * returned in the response body; anything without a known code (network
 * failures, 404 route-not-found, 5xx, …) falls back to a generic localised
 * failure so the user never sees raw English server text.
 */
export const localizedApiError = (e: unknown, t: Translate): string => {
  const body = (e as ApiError | undefined)?.body as { error?: string } | undefined;
  switch (body?.error) {
    case "email_taken":
      return t("profile.errEmailTaken");
    case "invalid_code":
      return t("profile.errInvalidCode");
    default:
      return t("form.errors.failed");
  }
};
