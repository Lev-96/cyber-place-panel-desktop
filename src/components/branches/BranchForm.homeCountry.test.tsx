// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchApi } from "@/types/api";

/**
 * The branch form's country and phone (2026-10-11): Armenia and +374, fixed on
 * create and on an Armenian branch's edit; a branch saved elsewhere keeps its
 * picker and its number. (Harness shared with BranchForm.status.test.tsx.)
 *
 * Branch status (Active / Inactive) in the one branch form.
 *
 * `status` says whether players can see the branch. It is the owner's switch
 * and the admin's; a manager never draws it. The backend applies it for admin
 * and the owner of the branch's company and drops it for anyone else — so what
 * this form must get right is narrower and easy to regress silently:
 *
 *  - the toggle exists for admin and owner, on create AND on edit, and never
 *    for a manager;
 *  - create always sends the status the form shows (Active unless moved);
 *  - edit sends it only when the user actually MOVED it — echoing the
 *    prefilled value on every save would let a stale form switch back a branch
 *    somebody else switched a minute ago.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "admin" } as { id: number; role: string } }));
const repo = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
const geo = vi.hoisted(() => ({ geocodeAddress: vi.fn() }));

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    update: (...a: unknown[]) => repo.update(...a),
    create: (...a: unknown[]) => repo.create(...a),
  },
}));
vi.mock("@/services/geocoding", () => ({ geocodeAddress: (q: string) => geo.geocodeAddress(q) }));
// The debounce is about typing comfort, not about status; without it the
// geocoder answers on the next tick instead of after 600 ms of real time.
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock("@/components/map/BranchMap", () => ({ default: () => null }));
vi.mock("@/components/ui/ImageUpload", () => ({ default: () => null }));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import BranchForm from "./BranchForm";

const GEO_HIT = {
  lat: 40.18,
  lng: 44.5,
  displayName: "Abovyan 5, Yerevan, Armenia",
  shortAddress: "Abovyan 5",
  city: "Yerevan",
  country: "Armenia",
  countryCode: "AM",
};

const existing = (over: Partial<IBranchApi> = {}): IBranchApi => ({
  id: 7,
  company_id: 3,
  city: "Yerevan",
  country: "Armenia",
  address: "Abovyan 5",
  address_lat: 40.18,
  address_lng: 44.5,
  phone: "+374 77 123456",
  branch_logo_path: "",
  status: "inactive",
  ratings_avg_rating: null,
  ...over,
});

const tel = () => document.querySelector<HTMLInputElement>('input[type="tel"]')!;
const sent = () => (repo.create.mock.calls[0]?.[0] ?? repo.update.mock.calls[0]?.[1]) as Record<string, unknown>;

beforeEach(() => {
  auth.user = { id: 1, role: "admin" };
  repo.create.mockReset(); repo.update.mockReset();
  repo.create.mockResolvedValue({ id: 9 }); repo.update.mockResolvedValue({ id: 7 });
  geo.geocodeAddress.mockReset();
  geo.geocodeAddress.mockResolvedValue([GEO_HIT]);
});
afterEach(cleanup);

describe("creating a branch: Armenia and +374", () => {
  test("the country is shown, not offered, and +374 is drawn, not typed", () => {
    render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByDisplayValue(/country\.armenia/)).toBeTruthy();
    expect(screen.getByTestId("fixed-dial").textContent).toContain("+374");
  });

  test("an address geocoded abroad does not move the country", async () => {
    geo.geocodeAddress.mockResolvedValue([{ ...GEO_HIT, country: "Georgia", countryCode: "GE" }]);
    render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("branch.addressPlaceholder"), { target: { value: "Rustaveli 1" } });
    await screen.findByText("branchForm.pinned");
    fireEvent.change(tel(), { target: { value: "77123456" } });
    await act(async () => { fireEvent.submit(document.querySelector("form")!); });

    await waitFor(() => expect(repo.create).toHaveBeenCalled());
    expect(sent()).toMatchObject({ country: "Armenia", phone: "+374 77 123456" });
  });

  test("a pasted full number keeps the code once; letters never land", async () => {
    render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(tel(), { target: { value: "+374 (77) 12-34-56" } });
    expect(tel().value).toBe("77123456");
    fireEvent.change(tel(), { target: { value: "0037477123456" } });
    expect(tel().value).toBe("77123456");
    fireEvent.change(tel(), { target: { value: "77abc" } });
    expect(tel().value).toBe("77");
  });

  test("an invalid number is refused before sending", async () => {
    render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("branch.addressPlaceholder"), { target: { value: "Abovyan 5" } });
    await screen.findByText("branchForm.pinned");
    fireEvent.change(tel(), { target: { value: "12" } });
    await act(async () => { fireEvent.submit(document.querySelector("form")!); });

    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("editing a branch", () => {
  test("an Armenian branch: fixed, the number shown without its code, saved unchanged", async () => {
    render(<BranchForm initial={existing()} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByText("branchForm.pinned");
    expect(tel().value).toBe("77123456");
    await act(async () => { fireEvent.submit(document.querySelector("form")!); });

    await waitFor(() => expect(repo.update).toHaveBeenCalled());
    expect(sent()).toMatchObject({ country: "Armenia", phone: "+374 77 123456" });
  });

  test("a branch saved in another country keeps its picker and its number as stored", async () => {
    render(<BranchForm initial={existing({ country: "Georgia", phone: "+995 555 123456" })} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByText("branchForm.pinned");
    expect(screen.queryByTestId("fixed-dial")).toBeNull();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(tel().value).toBe("+995 555 123456");
  });
});
