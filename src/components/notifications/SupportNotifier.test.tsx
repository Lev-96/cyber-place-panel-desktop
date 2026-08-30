// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import SupportNotifier from "./SupportNotifier";

/**
 * The card and the sound that go with a support reply.
 *
 * The sound assertion is the point: it is the ONE thing a person uses to tell
 * a support message from the day's operational traffic without looking, and
 * nothing else in the app would fail if this quietly went back to the shared
 * arpeggio.
 */

const sound = vi.hoisted(() => ({ support: vi.fn(), app: vi.fn() }));
const store = vi.hoisted(() => ({
  arrival: null as unknown,
  clearArrival: vi.fn(),
}));
const nav = vi.hoisted(() => ({ go: vi.fn() }));

vi.mock("@/utils/notificationSound", () => ({
  playSupportChime: sound.support,
  playNotificationChime: sound.app,
}));
vi.mock("@/support/SupportUnreadContext", () => ({
  useSupportUnread: () => ({ arrival: store.arrival, clearArrival: store.clearArrival }),
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => nav.go }));

const arrival = {
  id: 11,
  conversationId: 1,
  reference: "CP-1001",
  senderName: "Cyber Place Support",
  preview: "Мы получили ваше сообщение",
};

beforeEach(() => {
  sound.support.mockReset();
  sound.app.mockReset();
  store.clearArrival.mockReset();
  nav.go.mockReset();
  store.arrival = null;
});
afterEach(cleanup);

describe("SupportNotifier", () => {
  test("plays the SUPPORT chime, never the app's", async () => {
    store.arrival = arrival;
    await act(async () => { render(<SupportNotifier />); });

    expect(sound.support).toHaveBeenCalledTimes(1);
    expect(sound.app).not.toHaveBeenCalled();
  });

  test("shows the sender and the preview", async () => {
    store.arrival = arrival;
    await act(async () => { render(<SupportNotifier />); });

    expect(screen.getByText("Cyber Place Support")).toBeTruthy();
    expect(screen.getByText("Мы получили ваше сообщение")).toBeTruthy();
    // The reference is how support quotes a thread back.
    expect(screen.getByText(/CP-1001/)).toBeTruthy();
  });

  test("nothing is rendered and nothing sounds without an arrival", async () => {
    await act(async () => { render(<SupportNotifier />); });

    expect(document.querySelector(".support-toast")).toBeNull();
    expect(sound.support).not.toHaveBeenCalled();
  });

  test("Open goes to Support and takes the card with it", async () => {
    store.arrival = arrival;
    await act(async () => { render(<SupportNotifier />); });

    fireEvent.click(screen.getByText(/support.toast.open/));

    expect(nav.go).toHaveBeenCalledWith("/support");
    expect(store.clearArrival).toHaveBeenCalled();
  });

  test("Close dismisses without navigating", async () => {
    store.arrival = arrival;
    await act(async () => { render(<SupportNotifier />); });

    fireEvent.click(screen.getByText("action.close"));

    expect(store.clearArrival).toHaveBeenCalled();
    expect(nav.go).not.toHaveBeenCalled();
  });
});
