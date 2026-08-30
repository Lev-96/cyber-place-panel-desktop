import { describe, expect, it } from "vitest";

import { mayNavigateTo, mayOpenExternally, navigationKeyFor } from "../electron/urlPolicy";

/**
 * The main process acts on two kinds of URL, and both used to be unrestricted.
 *
 * `setWindowOpenHandler` handed everything to `shell.openExternal`, so the OS
 * launched any scheme it was given — and the URLs reaching it are server
 * supplied (PulseDashboardCard opens `link.url` from POST /admin/pulse/access,
 * Metrics opens `data.dashboard_url`). There was no `will-navigate` handler at
 * all, so the renderer could navigate off `app://localhost` and take the
 * preload — including `kv:get`, which returns the Sanctum token — with it.
 *
 * These tests are the reason the decision lives in pure functions.
 */
describe("mayOpenExternally", () => {
  it("allows https, which is what both real callers use", () => {
    expect(mayOpenExternally("https://cyberplace.pro/pulse-access/abc")).toBe(true);
    expect(mayOpenExternally("https://metrika.yandex.ru/dashboard?id=1")).toBe(true);
  });

  it("allows plain http only against loopback, for a local backend", () => {
    expect(mayOpenExternally("http://localhost:8000/pulse-access/abc")).toBe(true);
    expect(mayOpenExternally("http://127.0.0.1:8000/pulse-access/abc")).toBe(true);
  });

  it("refuses plain http to any other host", () => {
    expect(mayOpenExternally("http://attacker.example/x")).toBe(false);
    expect(mayOpenExternally("http://localhost.attacker.example/x")).toBe(false);
  });

  it("refuses file:// — the original hole", () => {
    expect(mayOpenExternally("file:///etc/passwd")).toBe(false);
    expect(mayOpenExternally("file://///attacker/share/payload.lnk")).toBe(false);
  });

  it("refuses OS handler and script schemes", () => {
    for (const url of [
      "smb://attacker/share",
      "ms-msdt:/id PCWDiagnostic",
      "search-ms:query=x&crumb=location:\\\\attacker\\share",
      "javascript:fetch('/x')",
      "data:text/html,<script>1</script>",
      "vbscript:msgbox",
    ]) {
      expect(mayOpenExternally(url), url).toBe(false);
    }
  });

  it("refuses anything that is not a URL at all", () => {
    expect(mayOpenExternally("")).toBe(false);
    expect(mayOpenExternally("not a url")).toBe(false);
    expect(mayOpenExternally("/relative/path")).toBe(false);
  });
});

describe("mayNavigateTo", () => {
  const allowed = ["app://localhost"];

  it("allows the bundled app origin, including deeper paths", () => {
    expect(mayNavigateTo("app://localhost/index.html", allowed)).toBe(true);
    expect(mayNavigateTo("app://localhost/assets/index-abc.js", allowed)).toBe(true);
  });

  it("blocks every other origin", () => {
    expect(mayNavigateTo("https://attacker.example/", allowed)).toBe(false);
    expect(mayNavigateTo("app://attacker/index.html", allowed)).toBe(false);
    expect(mayNavigateTo("file:///etc/passwd", allowed)).toBe(false);
  });

  it("allows a dev server only when it is in the allow-list", () => {
    expect(mayNavigateTo("http://localhost:5173/", allowed)).toBe(false);
    expect(mayNavigateTo("http://localhost:5173/", [...allowed, "http://localhost:5173"])).toBe(true);
  });

  it("treats a different port as a different origin", () => {
    const withDev = [...allowed, "http://localhost:5173"];
    expect(mayNavigateTo("http://localhost:5174/", withDev)).toBe(false);
  });

  it("refuses anything that is not a URL", () => {
    expect(mayNavigateTo("", allowed)).toBe(false);
    expect(mayNavigateTo("not a url", allowed)).toBe(false);
  });
});

describe("navigationKeyFor", () => {
  it("reduces a URL to protocol//host, ignoring path and query", () => {
    expect(navigationKeyFor("http://localhost:5173/index.html?x=1")).toBe("http://localhost:5173");
    expect(navigationKeyFor("app://localhost/index.html")).toBe("app://localhost");
  });

  it("returns null for a non-URL so the caller can drop it", () => {
    expect(navigationKeyFor("")).toBeNull();
    expect(navigationKeyFor("nonsense")).toBeNull();
  });
});
