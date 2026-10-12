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

// A label may end in the red required mark (its own span), so match its text without it.
const labelEl = (label: string) =>
  screen.getByText((_, el) => !!el && el.matches(".label, label") && el.textContent?.replace(/\*$/, "").trim() === label);
const byLabel = (label: string) => labelEl(label).parentElement!.querySelector("input") as HTMLInputElement;
const isMarkedRequired = (label: string) => !!labelEl(label).querySelector(".req-mark");

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
  fireEvent.change(byLabel("Website"), { target: { value: over.website ?? "club.am" } });
  fireEvent.change(byLabel("Description"), { target: { value: over.description ?? "Gaming club" } });
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
  test("Armenia sits in a DISABLED picker; +374 is a grey, non-editable prefix", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();

    const country = screen.getByRole("combobox", { name: "Country" }) as HTMLSelectElement;
    expect(country.disabled).toBe(true);
    expect([...country.options].map((o) => o.textContent)).toEqual(["🇦🇲 Armenia"]);
    const dial = screen.getByTestId("fixed-dial");
    expect(dial.textContent).toContain("+374");
    // The prefix is text, not a field: nothing to focus or change.
    expect(dial.querySelector("input, select")).toBeNull();
    expect(dial.closest(".phone-group")!.querySelectorAll("input")).toHaveLength(1);
    // The national number stays editable.
    expect((document.querySelector('input[type="tel"]') as HTMLInputElement).disabled).toBe(false);
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

/** Website and description are OPTIONAL; the fields the server requires carry the red mark (2026-10-12). */
describe("creating a company: what is required", () => {
  test("the required fields carry the red mark; website and description do not", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    expect(isMarkedRequired("Owner full name")).toBe(true);
    expect(isMarkedRequired("Owner email")).toBe(true);
    await toStep2();
    // The logo picker is stubbed here; its mark is ImageUpload's own `required`.
    for (const label of ["Company name", "Email", "Phone", "Country", "City", "TIN"]) {
      expect(isMarkedRequired(label), label).toBe(true);
    }
    expect(isMarkedRequired("Website")).toBe(false);
    expect(isMarkedRequired("Description")).toBe(false);
    expect(byLabel("Website").getAttribute("aria-required")).toBeNull();
  });

  test("no website and no description: the company is created", async () => {
    const onSaved = vi.fn();
    render(<CompanyForm onClose={() => {}} onSaved={onSaved} />);
    await toStep2();
    await fillCompany({ website: "", description: "   " });
    await submit();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(posted()).toHaveLength(1);
  });

  test("a typed website that is not an address: said next to the field, nothing sent, the rest kept", async () => {
    render(<CompanyForm onClose={() => {}} onSaved={() => {}} />);
    await toStep2();
    for (const bad of ["not a site", "club", "ftp://club.am"]) {
      await fillCompany({ website: bad });
      await submit();
      expect(posted()).toHaveLength(0);
      expect(screen.getByText("Enter a website address, e.g. https://club.am")).toBeTruthy();
      expect(byLabel("Website").getAttribute("aria-invalid")).toBe("true");
      expect(byLabel("Company name").value).toBe("Probe Co");
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
  });

  test("a company saved in another country keeps its pickers and its number", () => {
    render(<CompanyForm initial={company({ company_country: "Georgia", phone: "+995 555 123456" })} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByTestId("fixed-dial")).toBeNull();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });
});
