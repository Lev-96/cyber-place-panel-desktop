// @vitest-environment jsdom
import { Role } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import Sidebar from "./Sidebar";

const auth = vi.hoisted(() => ({ user: null as { id: number; name: string; email: string; role: Role } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
// The picker itself has its own test; here we only care that it is reachable.
vi.mock("@/components/profile/AccountSwitchPanel", () => ({
  default: () => <div data-testid="switch-panel" />,
}));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

const asRole = (role: Role) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role };
  return render(<MemoryRouter><Sidebar /></MemoryRouter>);
};

const openCard = async () => {
  const card = document.querySelector("button.user-card") as HTMLButtonElement;
  await act(async () => { fireEvent.click(card); });
};

afterEach(() => cleanup());

describe("Sidebar — account switch entry point", () => {
  test("an owner is offered the account switch", async () => {
    asRole("company_owner");
    await openCard();

    expect(screen.getByText("switchAccount.cta")).toBeTruthy();
  });

  test("a MANAGER is offered it too — switching must not be a one-way street", async () => {
    asRole("manager");
    await openCard();

    expect(screen.getByText("switchAccount.cta")).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByText("switchAccount.cta")); });
    expect(screen.getByTestId("switch-panel")).toBeTruthy();
  });

  test("an admin belongs to no company, so there is nothing to switch to", async () => {
    asRole("admin");
    await openCard();

    expect(screen.queryByText("switchAccount.cta")).toBeNull();
  });
});
