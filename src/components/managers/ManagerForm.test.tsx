// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Adding a manager (2026-09-30): name and email only — the manager gets an
 * email link and sets their own password, so the form has no password field
 * and none is sent. A refusal is shown the way the server worded it.
 */

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body?: unknown }>,
  fail: null as null | Error,
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    api.calls.push(call);
    if (path === "/branches/12") return Promise.resolve({ branch: { id: 12, company_id: 4 } });
    if (path === "/managers" && call.method === "POST") {
      return api.fail ? Promise.reject(api.fail) : Promise.resolve({ manager: { id: 1 } });
    }
    return Promise.reject(new Error(`unexpected ${call.method} ${path}`));
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en") }) };
});
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

import ManagerForm from "./ManagerForm";

beforeEach(() => { api.calls = []; api.fail = null; });
afterEach(() => cleanup());

const fill = async () => {
  await waitFor(() => expect(api.calls.some((c) => c.path === "/branches/12")).toBe(true));
  fireEvent.change(document.querySelector("input:not([type])") as HTMLInputElement, { target: { value: "Mia" } });
  fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "mia@club.test" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create" })); });
};

describe("adding a manager", () => {
  test("sends name, email, branch and company, and no password", async () => {
    const onSaved = vi.fn();
    render(<ManagerForm branchId={12} onClose={() => {}} onSaved={onSaved} />);

    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText(/email a link/)).toBeTruthy();
    await fill();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = api.calls.find((c) => c.method === "POST" && c.path === "/managers");
    expect(post?.body).toEqual({ branch_id: 12, company_id: 4, name: "Mia", email: "mia@club.test" });
  });

  test("a taken email is shown as the server wrote it", async () => {
    api.fail = Object.assign(new Error("invalid"), {
      status: 422, body: { message: "invalid", errors: { email: ["The email has already been taken."] } },
    });
    render(<ManagerForm branchId={12} onClose={() => {}} onSaved={() => {}} />);
    await fill();

    expect(await screen.findByText("email: The email has already been taken.")).toBeTruthy();
  });
});
