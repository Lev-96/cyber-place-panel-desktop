// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * «Мои партнёры» (2026-11-18): an owner's one company is opened without a
 * question; an admin with several picks one first. Another company starts on
 * its own screen.
 */
const companies = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/CompanyRepository", () => ({ companyRepository: { list: (...a: unknown[]) => companies.list(...a) } }));
const screenProps = vi.hoisted(() => ({ ids: [] as number[] }));
vi.mock("@/components/partners/PartnersScreen", () => ({
  default: ({ companyId }: { companyId: number }) => { screenProps.ids.push(companyId); return <div data-testid="partners-for">{companyId}</div>; },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "ru" }) }));
vi.mock("@/components/ui/ScreenWithBg", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import Partners from "./Partners";

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); }); };

beforeEach(() => { companies.list.mockReset(); screenProps.ids = []; });
afterEach(() => cleanup());

describe("Partners route", () => {
  test("one company: opened straight away, no picker", async () => {
    companies.list.mockResolvedValue([{ id: 4, name: "Cyber One" }]);
    await act(async () => { render(<Partners />); });
    await settle();
    expect(screen.queryByTestId("partners-company")).toBeNull();
    expect(screen.getByTestId("partners-for").textContent).toBe("4");
  });

  test("several companies: nothing until one is picked", async () => {
    companies.list.mockResolvedValue([{ id: 4, name: "Cyber One" }, { id: 5, name: "Cyber Two" }]);
    await act(async () => { render(<Partners />); });
    await settle();
    expect(screen.queryByTestId("partners-for")).toBeNull();
    await act(async () => { fireEvent.change(screen.getByTestId("partners-company"), { target: { value: "5" } }); });
    expect(screen.getByTestId("partners-for").textContent).toBe("5");
  });

  test("no company at all: the empty state, not a blank screen", async () => {
    companies.list.mockResolvedValue([]);
    await act(async () => { render(<Partners />); });
    await settle();
    expect(screen.getByText("revenue.state.noCompanyTitle")).toBeTruthy();
    expect(screen.getByText("partners.state.noCompanyDescription")).toBeTruthy();
  });
});
