// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchApi } from "@/types/api";

/**
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

const toggle = () => screen.queryByRole("group", { name: "branch.status" });
const pressed = (s: "active" | "inactive") =>
  screen.getByRole("button", { name: `branch.status.${s}` }).getAttribute("aria-pressed");

/** Mount an edit form and wait until the saved address is geocoder-confirmed. */
const mountEdit = async (initial: IBranchApi) => {
  render(<BranchForm initial={initial} onClose={() => {}} onSaved={() => {}} />);
  await screen.findByText("branchForm.pinned");
};

/** Mount a create form and fill the fields the form refuses to save without. */
const mountCreateAndFill = async () => {
  const { container } = render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText("branch.addressPlaceholder"), { target: { value: "Abovyan 5" } });
  await screen.findByText("branchForm.pinned");
  const phone = container.querySelector<HTMLInputElement>('input[type="tel"]');
  expect(phone).not.toBeNull();
  fireEvent.change(phone!, { target: { value: "+374 77 123456" } });
};

const save = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "action.save" }));
  });
};

/** The body the form handed to `branchRepository.update`. */
const sentUpdate = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1));
  const [id, body] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
  expect(id).toBe(7);
  return body;
};

/** The body the form handed to `branchRepository.create`. */
const sentCreate = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
  expect(repo.update).not.toHaveBeenCalled();
  return (repo.create.mock.calls[0] as [Record<string, unknown>])[0];
};

beforeEach(() => {
  geo.geocodeAddress.mockResolvedValue([GEO_HIT]);
  repo.update.mockImplementation(async (_id: number, b: Record<string, unknown>) => ({ ...existing(), ...b }));
  repo.create.mockImplementation(async (b: Record<string, unknown>) => ({ ...existing(), ...b }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  auth.user = { id: 1, role: "admin" };
});

describe.each(["admin", "company_owner"])("%s editing a branch", (role) => {
  beforeEach(() => {
    auth.user = { id: 1, role };
  });

  test("sees the toggle prefilled from the branch", async () => {
    await mountEdit(existing());

    expect(toggle()).not.toBeNull();
    expect(pressed("inactive")).toBe("true");
    expect(pressed("active")).toBe("false");
  });

  test("switching it on sends status: active with the rest of the form", async () => {
    await mountEdit(existing());

    fireEvent.click(screen.getByRole("button", { name: "branch.status.active" }));
    await save();

    const body = await sentUpdate();
    expect(body.status).toBe("active");
    // The rest of the form still travels — the switch is not a separate call.
    expect(body.address).toBe("Abovyan 5");
  });

  test("switching it off sends status: inactive", async () => {
    await mountEdit(existing({ status: "active" }));

    fireEvent.click(screen.getByRole("button", { name: "branch.status.inactive" }));
    await save();

    expect((await sentUpdate()).status).toBe("inactive");
  });

  test("a save that leaves the toggle alone does not send status", async () => {
    await mountEdit(existing());

    await save();

    expect(await sentUpdate()).not.toHaveProperty("status");
  });

  test("moving it and moving it back sends nothing", async () => {
    await mountEdit(existing({ status: "active" }));

    fireEvent.click(screen.getByRole("button", { name: "branch.status.inactive" }));
    fireEvent.click(screen.getByRole("button", { name: "branch.status.active" }));
    await save();

    expect(await sentUpdate()).not.toHaveProperty("status");
  });

  test("an older backend that omits status reads as active and sends nothing", async () => {
    await mountEdit(existing({ status: undefined }));

    expect(pressed("active")).toBe("true");
    await save();

    expect(await sentUpdate()).not.toHaveProperty("status");
  });
});

describe.each(["admin", "company_owner"])("%s creating a branch", (role) => {
  beforeEach(() => {
    auth.user = { id: 1, role };
  });

  test("sees the toggle, starting on Active", async () => {
    render(<BranchForm companyId={3} onClose={() => {}} onSaved={() => {}} />);

    expect(toggle()).not.toBeNull();
    expect(pressed("active")).toBe("true");
    expect(pressed("inactive")).toBe("false");
  });

  test("an untouched toggle still sends status: active", async () => {
    await mountCreateAndFill();
    await save();

    const body = await sentCreate();
    expect(body.status).toBe("active");
    expect(body.company_id).toBe(3);
  });

  test("choosing Inactive creates the branch inactive", async () => {
    await mountCreateAndFill();
    fireEvent.click(screen.getByRole("button", { name: "branch.status.inactive" }));
    await save();

    expect((await sentCreate()).status).toBe("inactive");
  });
});

describe("a manager", () => {
  beforeEach(() => {
    auth.user = { id: 2, role: "manager" };
  });

  test("editing gets no toggle and never sends status", async () => {
    await mountEdit(existing());

    expect(toggle()).toBeNull();
    expect(screen.queryByRole("button", { name: "branch.status.active" })).toBeNull();
    await save();

    expect(await sentUpdate()).not.toHaveProperty("status");
  });

  // A manager has no `branch.create` and no screen offers them the form; if
  // one ever did, the server default (active) decides rather than this form.
  test("creating gets no toggle and sends no status", async () => {
    await mountCreateAndFill();

    expect(toggle()).toBeNull();
    await save();

    expect(await sentCreate()).not.toHaveProperty("status");
  });
});
