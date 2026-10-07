// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Customers (2026-10-07): a first load that failed sat on the skeleton for
 * ever, and a server search with no hit said "No customers yet" — which reads
 * as "this branch has none". Each is its own state now.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/MemberRepository", () => ({
  memberRepository: { list: (...a: unknown[]) => repo.list(...a) },
}));
vi.mock("@/components/members/MemberForm", () => ({ default: () => null }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import MembersList from "./MembersList";

const ANNA = { id: 3, branch_id: 7, name: "Anna", phone: null, email: null, card_code: null, balance: 0 };

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/7/members"]}>
        <Routes><Route path="/branches/:branchId/members" element={<MembersList />} /></Routes>
      </MemoryRouter>,
    );
  });
};
const search = async (text: string) => {
  fireEvent.change(screen.getByPlaceholderText("members.search"), { target: { value: text } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.search" })); });
};

afterEach(() => cleanup());
beforeEach(() => { repo.list.mockReset(); });

describe("MembersList — states", () => {
  test("a failed first load is the error with Retry, not a skeleton for ever", async () => {
    repo.list.mockRejectedValueOnce(Object.assign(new Error("Server Error"), { status: 500, body: { message: "Server Error" } }))
      .mockResolvedValue([ANNA]);
    await mount();

    expect(screen.getByText("members.state.errorTitle")).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.retry" })); });
    expect(screen.getByText("Anna")).toBeTruthy();
  });

  test("no customers at all is the empty state", async () => {
    repo.list.mockResolvedValue([]);
    await mount();

    expect(repo.list).toHaveBeenCalledWith(7, "");
    expect(screen.getByText("members.state.emptyTitle")).toBeTruthy();
  });

  test("a search with no hit is «nothing found», never «no customers yet»", async () => {
    repo.list.mockResolvedValueOnce([ANNA]).mockResolvedValue([]);
    await mount();
    await search("zzz");

    expect(repo.list).toHaveBeenLastCalledWith(7, "zzz");
    expect(screen.getByText("state.noResults.title")).toBeTruthy();
    expect(screen.getByText("members.state.noResultsDescription")).toBeTruthy();
    expect(screen.queryByText("members.state.emptyTitle")).toBeNull();
  });

  test("results arriving after an empty answer replace the empty state", async () => {
    repo.list.mockResolvedValueOnce([]).mockResolvedValue([ANNA]);
    await mount();
    expect(screen.getByText("members.state.emptyTitle")).toBeTruthy();

    await search("Anna");
    expect(screen.queryByText("members.state.emptyTitle")).toBeNull();
    expect(screen.getByText("Anna")).toBeTruthy();
  });
});
