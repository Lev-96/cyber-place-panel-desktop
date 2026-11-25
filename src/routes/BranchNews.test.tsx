// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const repo = vi.hoisted(() => ({ news: vi.fn(), postNews: vi.fn(), removeNews: vi.fn() }));
const asked = vi.hoisted(() => ({ answer: true, question: "" }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async (q: string) => { asked.question = q; return asked.answer; } }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: {
    news: (...a: unknown[]) => repo.news(...a), postNews: (...a: unknown[]) => repo.postNews(...a), removeNews: (...a: unknown[]) => repo.removeNews(...a),
  },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
const picked = vi.hoisted(() => ({ onChange: null as null | ((f: File | null) => void) }));
vi.mock("@/components/ui/ImageUpload", () => ({ default: (p: { onChange: (f: File | null) => void }) => { picked.onChange = p.onChange; return <div data-testid="image-upload" />; } }));
vi.mock("@/infrastructure/AppConfig", () => ({ storageUri: (p?: string | null) => (p ? "/storage/" + p : null) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => (k === "news.removeConfirm" ? "Delete «{0}»?" : k) }) }));

import BranchNews from "./BranchNews";

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter initialEntries={["/branches/7/bonus/news"]}><Routes><Route path="/branches/:branchId/bonus/news" element={<BranchNews />} /></Routes></MemoryRouter>);
  });
};
afterEach(() => cleanup());
beforeEach(() => {
  repo.news.mockReset(); repo.postNews.mockReset(); repo.removeNews.mockReset(); asked.answer = true;
  repo.news.mockResolvedValue([{ id: 5, title: "Tournament on Friday", body: "Sign up at the desk.", at: "2026-11-25T10:00:00+04:00" }]);
});

describe("«Новости клуба» (2026-11-25)", () => {
  test("the branch's news is listed, newest as the server gives it", async () => {
    await mount();
    expect(repo.news).toHaveBeenCalledWith(7);
    expect(screen.getByText("Tournament on Friday")).toBeTruthy();
    expect(screen.getByText("Sign up at the desk.")).toBeTruthy();
  });

  test("nothing is sent without a headline; spaces alone are no headline", async () => {
    await mount();
    const publish = screen.getByTestId("news-publish") as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("news-title"), { target: { value: "   " } });
    expect(publish.disabled).toBe(true);
  });

  test("published trimmed, an empty text sent as null; the form clears and the list reloads", async () => {
    repo.postNews.mockResolvedValue({ id: 6, title: "New game", body: null, at: null });
    await mount();
    fireEvent.change(screen.getByTestId("news-title"), { target: { value: "  New game  " } });
    fireEvent.change(screen.getByTestId("news-body"), { target: { value: "   " } });
    await act(async () => { fireEvent.submit(screen.getByTestId("news-form")); });
    expect(repo.postNews).toHaveBeenCalledWith(7, { title: "New game", body: null });
    expect((screen.getByTestId("news-title") as HTMLInputElement).value).toBe("");
    expect(repo.news).toHaveBeenCalledTimes(2);
  });

  test("a picked picture goes with the post; the next post starts without it", async () => {
    repo.postNews.mockResolvedValue({ id: 7, title: "Cup", body: null, image_path: "images/news/a.png", at: null });
    await mount();
    const file = new File(["x"], "cup.png", { type: "image/png" });
    await act(async () => { picked.onChange!(file); });
    fireEvent.change(screen.getByTestId("news-title"), { target: { value: "Cup" } });
    await act(async () => { fireEvent.submit(screen.getByTestId("news-form")); });
    expect(repo.postNews).toHaveBeenLastCalledWith(7, { title: "Cup", body: null, image: file });
    fireEvent.change(screen.getByTestId("news-title"), { target: { value: "Next" } });
    await act(async () => { fireEvent.submit(screen.getByTestId("news-form")); });
    expect(repo.postNews).toHaveBeenLastCalledWith(7, { title: "Next", body: null });
  });

  test("a news picture is shown in the list", async () => {
    repo.news.mockResolvedValue([{ id: 9, title: "Cup", body: null, image_path: "images/news/a.png", at: null }]);
    await mount();
    expect((document.querySelector(".news-item__img") as HTMLImageElement).getAttribute("src")).toBe("/storage/images/news/a.png");
  });

  test("a refusal is said and the text stays to fix it", async () => {
    repo.postNews.mockRejectedValue(new Error("Write a headline for the news."));
    await mount();
    fireEvent.change(screen.getByTestId("news-title"), { target: { value: "Offer" } });
    await act(async () => { fireEvent.submit(screen.getByTestId("news-form")); });
    expect(screen.getByRole("alert").textContent).toBe("Write a headline for the news.");
    expect((screen.getByTestId("news-title") as HTMLInputElement).value).toBe("Offer");
  });

  test("delete asks first; a «no» deletes nothing", async () => {
    repo.removeNews.mockResolvedValue({ deleted: true });
    await mount();
    asked.answer = false;
    await act(async () => { fireEvent.click(screen.getByTestId("news-remove-5")); });
    expect(asked.question).toBe("Delete «Tournament on Friday»?");
    expect(repo.removeNews).not.toHaveBeenCalled();
    asked.answer = true;
    await act(async () => { fireEvent.click(screen.getByTestId("news-remove-5")); });
    expect(repo.removeNews).toHaveBeenCalledWith(7, 5);
  });
});
