import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Expenses and tariffs report their create / edit / delete through the shared
 * toast, as every other catalogue does (2026-09-28): green on success, red on
 * failure, and the failure still reaches the form's own inline error.
 */

const { fail, answer } = vi.hoisted(() => {
  const fail = { next: false };
  const answer = <T,>(value: T) => async () => {
    if (fail.next) { fail.next = false; throw new Error("refused"); }
    return value;
  };
  return { fail, answer };
});

vi.mock("@/api/expenses", () => ({
  apiCreateServiceExpense: vi.fn(answer({ data: { id: 1 } })),
  apiUpdateServiceExpense: vi.fn(answer({ data: { id: 1 } })),
  apiDeleteServiceExpense: vi.fn(answer(undefined)),
  apiMarkServiceExpensePaid: vi.fn(),
  apiServiceExpenseReminders: vi.fn(),
  apiServiceExpenses: vi.fn(),
}));
vi.mock("@/api/timePackages", () => ({
  apiCreatePackage: vi.fn(answer({ package: { id: 1 } })),
  apiUpdatePackage: vi.fn(answer({ package: { id: 1 } })),
  apiDeletePackage: vi.fn(answer({ message: "ok" })),
  apiListPackagesForBranch: vi.fn(),
}));
vi.mock("@/api/fallback", () => ({ friendlyMutation: <T,>(p: Promise<T>) => p, orFallback: <T,>(p: Promise<T>) => p }));

import type { ServiceExpenseBody } from "@/api/expenses";
import type { CreateTimePackageBody } from "@/api/timePackages";
import { notify, ToastEvent } from "@/ui/notify";
import { expenseRepository } from "./ExpenseRepository";
import { timePackageRepository } from "./TimePackageRepository";

let seen: ToastEvent[] = [];
let off: () => void = () => {};
beforeEach(() => { seen = []; fail.next = false; off = notify.subscribe((e) => seen.push(e)); });
afterEach(() => off());

const said = () => seen.map((e) => `${e.kind}:${e.entity}.${e.action}`);

describe("expense and tariff toasts", () => {
  test("an expense is announced on create, edit and delete", async () => {
    await expenseRepository.create({} as ServiceExpenseBody);
    await expenseRepository.update(1, {});
    await expenseRepository.remove(1);
    expect(said()).toEqual(["success:expense.created", "success:expense.updated", "success:expense.deleted"]);
  });

  test("a tariff is announced on create, edit and delete", async () => {
    await timePackageRepository.create({} as CreateTimePackageBody);
    await timePackageRepository.update(1, {});
    await timePackageRepository.remove(1);
    expect(said()).toEqual(["success:package.created", "success:package.updated", "success:package.deleted"]);
  });

  test("a refused delete is red and still rejects, so the screen keeps its own error", async () => {
    fail.next = true;
    await expect(expenseRepository.remove(1)).rejects.toThrow("refused");
    fail.next = true;
    await expect(timePackageRepository.remove(1)).rejects.toThrow("refused");
    expect(said()).toEqual(["error:expense.deleted", "error:package.deleted"]);
  });
});
