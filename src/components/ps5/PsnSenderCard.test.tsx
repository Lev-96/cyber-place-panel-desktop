// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { npssoOf } from "@/api/psn";

/**
 * The owner connects the PSN account PlayStation players are messaged from
 * (2026-10-12). What is pinned: the pasted page is reduced to the 64-character
 * code before anything is sent, nothing is sent for a paste that holds no such
 * code, and the card shows the server's state and never a token.
 */

const request = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ request, apiCache: { subscribe: () => () => {} } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import PsnSenderCard from "./PsnSenderCard";

const CODE = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz01";
const off = { connected: false, online_id: null, expires_at: null, last_error: null, last_error_at: null, last_sent_at: null };
const on = { ...off, connected: true, online_id: "CyberPlaceClub", expires_at: "2026-12-11T10:00:00+04:00" };

const mount = async () => {
  await act(async () => {
    render(<PsnSenderCard companyId={2} />);
  });
};
const paste = async (value: string) => {
  await act(async () => {
    fireEvent.change(screen.getByTestId("psn-npsso"), { target: { value } });
  });
};

beforeEach(() => {
  request.mockReset();
});
afterEach(cleanup);

describe("npssoOf", () => {
  test("takes the code out of the whole page or the bare value", () => {
    expect(npssoOf(`{"npsso":"${CODE}"}`)).toBe(CODE);
    expect(npssoOf(` {"npsso" : "${CODE}"} \n`)).toBe(CODE);
    expect(npssoOf(CODE)).toBe(CODE);
  });

  test("refuses anything else", () => {
    expect(npssoOf("")).toBeNull();
    expect(npssoOf(CODE.slice(1))).toBeNull();
    expect(npssoOf(`{"npsso":"${CODE}!"}`)).toBeNull();
    expect(npssoOf("hello")).toBeNull();
  });
});

describe("PsnSenderCard", () => {
  test("connects with the code alone and shows who it is", async () => {
    request.mockResolvedValueOnce({ data: off }).mockResolvedValueOnce({ data: on });
    await mount();
    expect(screen.getByText("psn.notConnected")).toBeTruthy();

    await paste(`{"npsso":"${CODE}"}`);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "psn.connect" }));
    });

    expect(request).toHaveBeenLastCalledWith("/companies/2/psn-sender", { method: "PUT", body: { npsso: CODE } });
    expect(screen.getByText("CyberPlaceClub")).toBeTruthy();
    expect((screen.getByTestId("psn-npsso") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("psn-npsso") as HTMLInputElement).type).toBe("password");
  });

  test("a paste with no code in it sends nothing", async () => {
    request.mockResolvedValueOnce({ data: off });
    await mount();
    await paste("not the page");

    expect((screen.getByRole("button", { name: "psn.connect" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("psn.pasteInvalid")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("a refusal is shown in the server's words", async () => {
    request.mockResolvedValueOnce({ data: off }).mockRejectedValueOnce(new Error("The PlayStation sign-in did not work."));
    await mount();
    await paste(CODE);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "psn.connect" }));
    });

    expect(screen.getByText("The PlayStation sign-in did not work.")).toBeTruthy();
    expect(screen.getByText("psn.notConnected")).toBeTruthy();
  });

  test("the last failure is named, and the owner can disconnect", async () => {
    request.mockResolvedValueOnce({ data: { ...on, last_error: "sign_in" } }).mockResolvedValueOnce({ data: off });
    await mount();
    expect(screen.getByText("psn.error.sign_in")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "psn.disconnect" }));
    });

    expect(request).toHaveBeenLastCalledWith("/companies/2/psn-sender", { method: "DELETE" });
    expect(screen.getByText("psn.notConnected")).toBeTruthy();
  });
});
