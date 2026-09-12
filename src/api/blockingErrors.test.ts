import { describe, expect, test } from "vitest";
import { TRANSLATIONS } from "@/i18n/translations";
import { blockedBodyOf, blockingKeyFor, blockingKeyOf, blockingMessage, lockoutKeyFor } from "./blockingErrors";

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

describe("lockoutKeyFor — why the access channel signed somebody out", () => {
  /**
   * `StaffAccessChanged` carries every block code AND reasons that are not a
   * block at all: an account deleted with its owner's company arrives as
   * `code: "account_deleted"`. The panel says it in its own language, exactly
   * like a block.
   */
  test("an account deleted with its company has the panel's own wording", () => {
    expect(lockoutKeyFor("account_deleted")).toBe("blocking.reason.account_deleted");
  });

  test("every block code is a lock-out reason too, with the same key", () => {
    for (const code of ["company_blocked", "branch_blocked", "branch_operation_blocked"]) {
      expect(lockoutKeyFor(code)).toBe(blockingKeyFor(code));
    }
  });

  test("an unknown code, a null and an absent one have no key — the caller shows the server's sentence", () => {
    expect(lockoutKeyFor("account_suspended")).toBeNull();
    expect(lockoutKeyFor(null)).toBeNull();
    expect(lockoutKeyFor(undefined)).toBeNull();
    expect(lockoutKeyFor(7)).toBeNull();
  });

  test("a deleted account is NOT a block: a request refused with that code is not dressed up as one", () => {
    // The login screen asks `blockingKeyOf` "was this a block?". A deletion is
    // a different fact, and widening the block set would change that answer.
    expect(blockingKeyFor("account_deleted")).toBeNull();
    expect(blockedBodyOf(apiError(403, { code: "account_deleted", message: "x" }))).toBeNull();
  });

  test("the deleted-account wording exists in all three languages", () => {
    const entry = TRANSLATIONS["blocking.reason.account_deleted"];
    expect(entry, "no translation entry for blocking.reason.account_deleted").toBeDefined();
    for (const lang of ["en", "ru", "am"] as const) {
      expect(entry[lang]?.length ?? 0).toBeGreaterThan(0);
    }
    // Three different sentences — not one language pasted into the others.
    expect(new Set([entry.en, entry.ru, entry.am]).size).toBe(3);
  });
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
