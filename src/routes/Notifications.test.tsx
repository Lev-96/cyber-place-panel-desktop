import { describe, expect, test } from "vitest";
import { shouldShowBookingsFeed, shouldShowBillingFeed } from "./Notifications";

/**
 * Regression-shield for the role gate that decides whether the
 * "Bookings" feed section renders on the Уведомления screen.
 *
 * Manager only — admin and company_owner are scoped to billing-only
 * by product (2026-05-29). Mirrors the backend
 * `StaffNotificationDispatcher` allowlist and the corner-popup gate
 * in `GlobalBookingNotifier.shouldShowBookingToasts`.
 */
describe("shouldShowBookingsFeed", () => {
  test("manager sees Bookings feed", () => {
    expect(shouldShowBookingsFeed("manager")).toBe(true);
  });
  test("admin does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed("admin")).toBe(false);
  });
  test("company_owner does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed("company_owner")).toBe(false);
  });
  test("undefined role does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed(undefined)).toBe(false);
  });
});

describe("shouldShowBillingFeed", () => {
  test("admin sees Billing feed", () => {
    expect(shouldShowBillingFeed("admin")).toBe(true);
  });
  test("company_owner sees Billing feed", () => {
    expect(shouldShowBillingFeed("company_owner")).toBe(true);
  });
  test("manager does NOT see Billing feed", () => {
    expect(shouldShowBillingFeed("manager")).toBe(false);
  });
  test("undefined role does NOT see Billing feed", () => {
    expect(shouldShowBillingFeed(undefined)).toBe(false);
  });
});
