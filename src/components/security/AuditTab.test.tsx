// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISecurityAuditEntryApi } from "@/api/security";

/** The audit log: worded actions, the action filter on the wire, unknown codes kept. */

interface Call { path: string; params?: Record<string, unknown> }
const api = vi.hoisted(() => ({ calls: [] as Array<{ path: string; params?: Record<string, unknown> }>, rows: [] as unknown[] }));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { params?: Record<string, unknown> } = {}) => {
    const call: Call = { path, params: opts.params };
    api.calls.push(call);
    return Promise.resolve({ data: api.rows, meta: { current_page: 1, last_page: 1, total: api.rows.length, per_page: 25 } });
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), lang: "ru" }) };
});

import AuditTab from "./AuditTab";

const ROWS: ISecurityAuditEntryApi[] = [
  { id: 1, action: "client_access.revoked", actor: { id: 1, name: "Root" }, subject: { type: "user", id: 12, label: "Ann Owner" }, meta: { client: "telegram" }, ip: "203.0.113.9", created_at: "2026-09-28T10:00:00Z" },
  { id: 2, action: "country.blocked", actor: null, subject: { type: "country", id: 5, label: "FR" }, meta: null, ip: null, created_at: "2026-09-28T11:00:00Z" },
  { id: 3, action: "future.thing", actor: null, subject: null, meta: null, ip: null, created_at: "2026-09-28T12:00:00Z" },
];

beforeEach(() => { api.calls = []; api.rows = ROWS; });
afterEach(() => cleanup());

describe("audit log", () => {
  test("words each action in the reading language and keeps an unknown code as-is", async () => {
    render(<AuditTab />);
    const first = (await screen.findByText("Root")).closest("tr") as HTMLElement;
    expect(first.textContent).toContain("Доступ отозван");
    expect(first.textContent).toContain("Telegram");

    const second = screen.getByText("Страна заблокирована", { selector: "td span" }).closest("tr") as HTMLElement;
    expect(second.textContent).toContain("(FR)");
    expect(second.textContent).toContain("Система");

    expect(screen.getByText("future.thing")).toBeTruthy();
  });

  test("the action filter goes to the server and restarts on page 1", async () => {
    render(<AuditTab />);
    await screen.findByText("Root");
    const select = screen.getByText("Действие", { selector: ".label" }).closest("label")?.querySelector("select") as HTMLSelectElement;

    await act(async () => { fireEvent.change(select, { target: { value: "ip.blocked" } }); });

    await waitFor(() => expect(api.calls.at(-1)?.params).toEqual({ action: "ip.blocked", page: 1 }));
    expect(api.calls.every((c) => c.path === "/admin/security/audit")).toBe(true);
  });
});
