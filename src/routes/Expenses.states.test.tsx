// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * Services (2026-10-07): "No services tracked yet." was said twice — by the
 * summary card and by the list under it. The screen's empty state says it
 * once; a failed read is an error, never that sentence.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/ExpenseRepository", () => ({
  expenseRepository: { list: (...a: unknown[]) => repo.list(...a) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/expenses/ExpenseForm", () => ({ default: () => null }));

import Expenses from "./Expenses";

afterEach(() => { cleanup(); repo.list.mockReset(); });

describe("Expenses — states", () => {
  test("nothing tracked: the empty state, once, and no summary card", async () => {
    repo.list.mockResolvedValue([]);
    await act(async () => { render(<Expenses />); });

    expect(screen.getAllByText("expenses.state.emptyTitle")).toHaveLength(1);
    expect(screen.queryByText("expenses.monthlyTotal")).toBeNull();
    expect(screen.queryByText("expenses.empty")).toBeNull();
  });

  test("a failed read is the error state, not «no services»", async () => {
    repo.list.mockRejectedValue(Object.assign(new Error("Server Error"), { status: 500 }));
    await act(async () => { render(<Expenses />); });

    expect(screen.getByText("expenses.state.errorTitle")).toBeTruthy();
    expect(screen.queryByText("expenses.state.emptyTitle")).toBeNull();
  });
});
