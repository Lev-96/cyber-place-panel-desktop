import { describe, expect, test } from "vitest";
import { TRANSLATIONS } from "@/i18n/translations";
import { blockedBodyOf, blockingKeyFor, blockingKeyOf, blockingMessage } from "./blockingErrors";

/**
 * The rule this module exists for: a refusal caused by an administrative block
 * is read in the OPERATOR's language, not in the one the server happened to
 * answer in — and anything that is not such a refusal is left completely
 * alone, so an ordinary 403 never gets dressed up as "you are blocked".
 */

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error("HTTP"), { status, body });

const t = (key: string) => `«${key}»`;

describe("blockingKeyFor", () => {
  test("maps every code the backend can send", () => {
    expect(blockingKeyFor("company_blocked")).toBe("blocking.reason.company_blocked");
    expect(blockingKeyFor("branch_blocked")).toBe("blocking.reason.branch_blocked");
    expect(blockingKeyFor("branch_operation_blocked")).toBe("blocking.reason.branch_operation_blocked");
  });

  test("refuses anything else, including a non-string", () => {
    expect(blockingKeyFor("nope")).toBeNull();
    expect(blockingKeyFor(undefined)).toBeNull();
    expect(blockingKeyFor(42)).toBeNull();
  });
});

describe("every code has real wording behind it", () => {
  /**
   * The mapping is only worth anything if the key it produces EXISTS. A code
   * mapped to a missing key renders as the key itself — "blocking.reason.x" on
   * screen — which is worse than the English sentence it replaced.
   */
  test.each(["company_blocked", "branch_blocked", "branch_operation_blocked"])(
    "%s is translated in all three languages",
    (code) => {
      const key = blockingKeyFor(code);
      expect(key).not.toBeNull();

      const entry = TRANSLATIONS[key as string];
      expect(entry, `no translation entry for ${key}`).toBeDefined();
      for (const lang of ["en", "ru", "am"] as const) {
        expect(entry[lang]?.length ?? 0).toBeGreaterThan(0);
      }
    },
  );
});

describe("blockedBodyOf", () => {
  test("recognises a coded block", () => {
    const body = { message: "Your branch has been blocked.", code: "branch_blocked", scope: "branch" };
    expect(blockedBodyOf(apiError(403, body))).toEqual(body);
  });

  test("an ordinary permission error is not a block", () => {
    expect(blockedBodyOf(apiError(403, { message: "You do not have permission." }))).toBeNull();
  });

  test("survives a body that is not an object at all", () => {
    expect(blockedBodyOf(apiError(500, "gateway exploded"))).toBeNull();
    expect(blockedBodyOf(new Error("network"))).toBeNull();
    expect(blockedBodyOf(undefined)).toBeNull();
  });
});

describe("blockingMessage", () => {
  test("translates a known code instead of echoing the server", () => {
    const error = apiError(403, {
      message: "Your branch has been blocked. Please contact the administrator.",
      code: "branch_blocked",
    });

    expect(blockingMessage(error, t)).toBe("«blocking.reason.branch_blocked»");
  });

  test("leaves a non-block error to its own caller", () => {
    expect(blockingMessage(apiError(422, { message: "Invalid" }), t)).toBeNull();
  });
});

describe("blockingKeyOf", () => {
  test("gives the key so a screen can re-render it after a language change", () => {
    expect(blockingKeyOf(apiError(403, { code: "company_blocked" })))
      .toBe("blocking.reason.company_blocked");
  });

  test("null for anything that was not a block", () => {
    expect(blockingKeyOf(apiError(401, { message: "Unauthenticated." }))).toBeNull();
  });
});
