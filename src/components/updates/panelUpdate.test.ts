import { describe, expect, test } from "vitest";
import type { IDbNotification } from "@/api/notifications";
import { t as translate } from "@/i18n/translations";
import { compareVersions, panelUpdateText, pendingPanelUpdate, updatesRouteFor } from "./panelUpdate";

/**
 * The panel-update notice (2026-11-20). Rows are `PanelUpdateAvailable` as the
 * backend writes them: `type` holds an English sentence, `data` the facts.
 */
const row = (id: string, version: string, over: Partial<IDbNotification> = {}, data: Record<string, unknown> = {}): IDbNotification => ({
  id,
  type: `A new Cyber Place version ${version} is ready: open «Updates»`,
  read_at: null,
  created_at: "2026-11-19T13:00:00Z",
  data: { type: "app_update.available", app: "panel", version, mandatory: false, ...data },
  ...over,
});

describe("pendingPanelUpdate", () => {
  test("the newest unread panel version, newer than the installed one", () => {
    const list = [row("a", "1.0.65"), row("b", "1.0.68"), row("c", "1.0.66")];
    expect(pendingPanelUpdate(list, new Set(), "1.0.64")?.id).toBe("b");
  });

  test("nothing once the installed version has caught up", () => {
    const list = [row("a", "1.0.66"), row("b", "1.0.68")];
    expect(pendingPanelUpdate(list, new Set(), "1.0.68")).toBeNull();
    expect(pendingPanelUpdate(list, new Set(), "1.0.69")).toBeNull();
    expect(pendingPanelUpdate(list, new Set(), "1.0.67")?.version).toBe("1.0.68");
  });

  test("an unknown installed version still shows it", () => {
    expect(pendingPanelUpdate([row("a", "1.0.68")], new Set(), null)?.id).toBe("a");
  });

  test("read, put off, other kinds and the Agent's are not shown", () => {
    const list = [
      row("read", "1.0.70", { read_at: "2026-11-19T14:00:00Z" }),
      row("later", "1.0.69"),
      row("agent", "1.0.71", {}, { app: "agent" }),
      { ...row("other", "1.0.72"), data: { type: "session.ending_soon", version: "1.0.72" } },
      row("noVersion", "", {}, { version: "" }),
    ];
    expect(pendingPanelUpdate(list, new Set(["later"]), "1.0.60")).toBeNull();
  });

  test("a row without `app` is the panel's", () => {
    const r = row("a", "1.0.68");
    delete r.data.app;
    expect(pendingPanelUpdate([r], new Set(), "1.0.60")?.id).toBe("a");
  });
});

describe("compareVersions", () => {
  test("numeric per part; staging.N counts as one more part", () => {
    expect(compareVersions("1.0.68", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.66", "1.0.68")).toBeLessThan(0);
    expect(compareVersions("1.0.68", "1.0.68")).toBe(0);
    expect(compareVersions("1.0.63-staging.2", "1.0.63-staging.1")).toBeGreaterThan(0);
  });
});

describe("updatesRouteFor", () => {
  test("admin → the release screen; owner / manager → «Обновление»", () => {
    expect(updatesRouteFor("admin")).toBe("/settings/updates");
    expect(updatesRouteFor("manager")).toBe("/settings/agent-updates");
    expect(updatesRouteFor("company_owner")).toBe("/settings/agent-updates");
  });
});

describe("panelUpdateText", () => {
  test("names the section and its button in each language", () => {
    expect(panelUpdateText("1.0.68", (k) => translate(k, "ru"))).toEqual({
      title: "Новая версия Cyber Place 1.0.68",
      body: "Откройте раздел «Обновление» и нажмите «Проверить обновления».",
    });
    expect(panelUpdateText("1.0.68", (k) => translate(k, "en"))).toEqual({
      title: "New Cyber Place version 1.0.68",
      body: "Open the «Updates» section and press «Check for updates».",
    });
    expect(panelUpdateText("1.0.68", (k) => translate(k, "am"))).toEqual({
      title: "Cyber Place-ի նոր տարբերակ՝ 1.0.68",
      body: "Բացեք «Թարմացում» բաժինը և սեղմեք «Ստուգել թարմացումները»։",
    });
  });
});
