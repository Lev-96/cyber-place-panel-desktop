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

const toStep2 = async () => {
  fireEvent.change(document.querySelector("input:not([type])") as HTMLInputElement, { target: { value: " Nora " } });
  fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "nora@club.test" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
};
/** Every field a valid create needs; `over` replaces a value ("" leaves it empty). */
const fillCompany = async (over: { website?: string; description?: string; phone?: string } = {}) => {
  fireEvent.change(byLabel("Company name"), { target: { value: "Probe Co" } });
  fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "probe@club.test" } });
  fireEvent.change(document.querySelector('input[type="tel"]') as HTMLInputElement, { target: { value: over.phone ?? "91234567" } });
  fireEvent.change(byLabel("City"), { target: { value: "Yerevan" } });
  fireEvent.change(byLabel("TIN"), { target: { value: "12345678" } });
  fireEvent.change(byLabel("Website *"), { target: { value: over.website ?? "club.am" } });
  fireEvent.change(byLabel("Description *"), { target: { value: over.description ?? "Gaming club" } });
  fireEvent.click(screen.getByRole("button", { name: "pick logo" }));
};
const submit = async () => { await act(async () => { fireEvent.submit(document.querySelector("form") as HTMLFormElement); }); };
const posted = () => api.calls.filter((c) => c.method === "POST" && c.path === "/company");

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

    await fillCompany();
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

/** Armenia and +374, fixed on create (2026-10-11). */
describe("creating a company: the country and the dial code are fixed", () => {
  test("Armenia is shown, not offered; +374 is drawn next to the number", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    const country = byLabel("Country");
    expect(country.value).toContain("Armenia");
    expect(country.readOnly).toBe(true);
    expect(screen.getByTestId("fixed-dial").textContent).toContain("+374");
  });

  test("a pasted +374 is not doubled, and the number is sent with the code once", async () => {
    const onSaved = vi.fn();
    render(<CompanyForm onClose={() => {}} onSaved={onSaved} />);
    await toStep2();
    await fillCompany({ phone: "+374 91 234567" });
    expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value).toBe("91234567");
    await submit();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const form = posted()[0].body as FormData;
    expect(form.get("phone")).toBe("+374 91 234567");
    expect(form.get("company_country")).toBe("Armenia");
  });

  test("an invalid Armenian number is refused before sending", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();
    await fillCompany({ phone: "12" });
    await submit();

    expect(posted()).toHaveLength(0);
    expect(screen.getByText("Enter a valid phone number for the selected country.")).toBeTruthy();
  });
});

/** Website and description are required on create (2026-10-11). */
describe("creating a company: website and description", () => {
  test("both are marked required before anything is sent", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();
    expect(byLabel("Website *").getAttribute("aria-required")).toBe("true");
    expect(byLabel("Description *").getAttribute("aria-required")).toBe("true");
  });

  test("empty or spaces only: said next to each field, nothing sent, the rest kept", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();
    await fillCompany({ website: "   ", description: "" });
    await submit();

    expect(posted()).toHaveLength(0);
    expect(screen.getByText("Enter the company's website")).toBeTruthy();
    expect(screen.getByText("Enter a description")).toBeTruthy();
    expect(byLabel("Website *").getAttribute("aria-invalid")).toBe("true");
    expect(byLabel("Company name").value).toBe("Probe Co");
    expect(byLabel("City").value).toBe("Yerevan");
  });

  test("not a website address: said next to the field, nothing sent", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();
    for (const bad of ["not a site", "club", "ftp://club.am"]) {
      await fillCompany({ website: bad });
      await submit();
      expect(posted()).toHaveLength(0);
      expect(screen.getByText("Enter a website address, e.g. https://club.am")).toBeTruthy();
    }
  });

  test("valid values are sent: https:// added to a bare host, the description trimmed", async () => {
    const onSaved = vi.fn();
    render(<CompanyForm onClose={() => {}} onSaved={onSaved} />);
    await toStep2();
    await fillCompany({ website: " club.am ", description: "  Gaming club  " });
    await submit();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const form = posted()[0].body as FormData;
    expect(form.get("website")).toBe("https://club.am");
    expect(form.get("description")).toBe("Gaming club");
  });
});

/** Editing keeps what is stored: another country stays editable, nothing is required anew. */
describe("editing a company", () => {
  const company = (over: Record<string, unknown>) => ({
    id: 5, name: "Probe Co", email: "probe@club.test", phone: "+374 91 234567", company_country: "Armenia",
    company_city: "Yerevan", tin: "12345678", website: "", description: "", status: "active", commission_percent: 0, ...over,
  }) as never;

  test("an Armenian company stays fixed to Armenia and +374, the number shown without the code", () => {
    render(<CompanyForm initial={company({})} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByTestId("fixed-dial").textContent).toContain("+374");
    expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value).toBe("91234567");
    expect(byLabel("Website").getAttribute("aria-required")).toBeNull();
  });

  test("a company saved in another country keeps its pickers and its number", () => {
    render(<CompanyForm initial={company({ company_country: "Georgia", phone: "+995 555 123456" })} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByTestId("fixed-dial")).toBeNull();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });
});
