// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { billingBlock, isBillingBlockBody } from "@/auth/billingBlock";
import { blockingKeyFor } from "@/api/blockingErrors";
import { networkBlockCodeOf } from "@/auth/networkBlock";
import BillingBlockedModal from "./BillingBlockedModal";

/**
 * Closed for an unpaid Cyber Place Platform bill (owner, 2026-11-09): one plain
 * Armenian screen, over everything; the code never locks the network or the
 * kiosk, and the login screen reads it as a block.
 */

beforeEach(() => { billingBlock.dismiss(); });
afterEach(cleanup);

describe("the billing block screen", () => {
  test("nothing until it is raised; then the Armenian reason and whom to call; OK closes it", () => {
    render(<BillingBlockedModal />);
    expect(screen.queryByTestId("billing-blocked")).toBeNull();
    act(() => billingBlock.raise());
    const screenEl = screen.getByTestId("billing-blocked");
    expect(screenEl.getAttribute("lang")).toBe("hy");
    expect(screen.getByRole("heading").textContent).toBe("Մուտքը ժամանակավորապես արգելափակված է");
    expect(screen.getByText(/կապվեք Cyber Place-ի ադմինիստրատորի հետ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Հասկանալի է" }));
    expect(screen.queryByTestId("billing-blocked")).toBeNull();
  });

  test("raised before the screen is mounted, it is still shown", () => {
    billingBlock.raise();
    render(<BillingBlockedModal />);
    expect(screen.getByTestId("billing-blocked")).toBeTruthy();
  });
});

describe("the code", () => {
  const body = { message: "…", code: "company_billing_blocked", scope: "billing", company_id: 2 };

  test("a 403 with it is the billing block; anything else is not", () => {
    expect(isBillingBlockBody(403, body)).toBe(true);
    expect(isBillingBlockBody(401, body)).toBe(false);
    expect(isBillingBlockBody(403, { code: "company_blocked" })).toBe(false);
  });

  test("it never locks the whole network (that is the kiosk/address block), and the login screen reads it as a block", () => {
    expect(networkBlockCodeOf(403, body)).toBeNull();
    expect(blockingKeyFor("company_billing_blocked")).toBe("blocking.reason.company_billing_blocked");
  });
});
