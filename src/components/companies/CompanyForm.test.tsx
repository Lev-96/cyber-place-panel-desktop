// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Creating a company with its owner (2026-09-30): ONE request carries both —
 * the owner's name and email with the company — and no password exists
 * anywhere in the form or on the wire. The owner gets an email link and sets
 * their own. `request()` is the only thing replaced.
 */

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body?: unknown }>,
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    api.calls.push(call);
    if (path === "/tin-rules") return Promise.reject(new Error("offline"));
    if (path === "/company" && call.method === "POST") return Promise.resolve({ companies: { id: 5, name: "Probe Co" } });
    return Promise.reject(new Error(`unexpected ${call.method} ${path}`));
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en") }) };
});
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/components/ui/ImageUpload", () => ({
  default: ({ onChange }: { onChange: (f: File | null) => void }) => (
    <button type="button" onClick={() => onChange(new File(["x"], "logo.png", { type: "image/png" }))}>pick logo</button>
  ),
}));

import CompanyForm from "./CompanyForm";

beforeEach(() => { api.calls = []; });
afterEach(() => cleanup());

const byLabel = (label: string) =>
  screen.getByText(label, { selector: ".label, label, span" }).parentElement!.querySelector("input") as HTMLInputElement;

describe("creating a company with its owner", () => {
  test("step 1 asks only for the owner's name and email", () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);

    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText(/email a link/)).toBeTruthy();
  });

  test("one POST /company carries the owner and the company, and no password", async () => {
    const onSaved = vi.fn();
    render(<CompanyForm onClose={() => {}} onSaved={onSaved} />);

    fireEvent.change(document.querySelector("input:not([type])") as HTMLInputElement, { target: { value: " Nora " } });
    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "nora@club.test" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });

    fireEvent.change(byLabel("Company name"), { target: { value: "Probe Co" } });
    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "probe@club.test" } });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "AM" } });
    fireEvent.change(document.querySelector('input[type="tel"]') as HTMLInputElement, { target: { value: "91234567" } });
    fireEvent.change(byLabel("City"), { target: { value: "Yerevan" } });
    fireEvent.change(byLabel("TIN"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "pick logo" }));
    await act(async () => { fireEvent.submit(document.querySelector("form") as HTMLFormElement); });

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const writes = api.calls.filter((c) => c.method !== "GET");
    expect(writes.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /company"]);

    const form = writes[0].body as FormData;
    expect(form.get("owner_name")).toBe("Nora");
    expect(form.get("owner_email")).toBe("nora@club.test");
    expect(form.get("name")).toBe("Probe Co");
    for (const key of ["user_id", "owner_password", "password", "password_confirmation"]) {
      expect(form.has(key), key).toBe(false);
    }
  });
});
