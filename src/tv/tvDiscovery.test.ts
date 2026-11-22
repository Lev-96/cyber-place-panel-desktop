import { afterEach, describe, expect, test, vi } from "vitest";
import { discoverTvs, FoundTv, panelTvEnv, splitByEnv, tvDiscoveryAvailable } from "./tvDiscovery";

const tv = (over: Partial<FoundTv> = {}): FoundTv => ({ address: "192.168.1.45", code: "123456", env: "staging", maker: "Sony", model: "BRAVIA", ...over });
const g = globalThis as { cyberplaceTV?: unknown };

afterEach(() => { delete g.cyberplaceTV; });

describe("panelTvEnv", () => {
  test("a staging build pairs staging TVs, a production build production ones, development any", () => {
    expect(panelTvEnv("staging")).toBe("staging");
    expect(panelTvEnv("production")).toBe("production");
    expect(panelTvEnv("development")).toBeNull();
    expect(panelTvEnv("test")).toBeNull();
  });
});

describe("splitByEnv", () => {
  test("keeps this backend's TVs, counts the others, sorts by name", () => {
    const r = splitByEnv([tv({ address: "1", maker: "TCL" }), tv({ address: "2", env: "production" }), tv({ address: "3", maker: "Philips" })], "staging");
    expect(r.matching.map((x) => x.address)).toEqual(["3", "1"]);
    expect(r.otherEnv).toBe(1);
  });
  test("development offers every TV", () => {
    expect(splitByEnv([tv(), tv({ address: "2", env: "production" })], null).matching).toHaveLength(2);
  });
});

describe("discoverTvs", () => {
  test("without the desktop bridge (owner web) there is nothing to search", async () => {
    expect(tvDiscoveryAvailable()).toBe(false);
    expect(await discoverTvs("staging")).toEqual({ matching: [], otherEnv: 0 });
  });

  test("asks the bridge for two seconds and keeps its own environment", async () => {
    const discover = vi.fn().mockResolvedValue([tv(), tv({ address: "2", env: "production" })]);
    g.cyberplaceTV = { discover };
    expect(tvDiscoveryAvailable()).toBe(true);
    const r = await discoverTvs("staging");
    expect(discover).toHaveBeenCalledWith(2000);
    expect(r.matching).toEqual([tv()]);
    expect(r.otherEnv).toBe(1);
  });

  test("a failing or odd bridge is an empty search, never an error", async () => {
    g.cyberplaceTV = { discover: vi.fn().mockRejectedValue(new Error("boom")) };
    expect(await discoverTvs("staging")).toEqual({ matching: [], otherEnv: 0 });
    g.cyberplaceTV = { discover: vi.fn().mockResolvedValue("nope") };
    expect(await discoverTvs("staging")).toEqual({ matching: [], otherEnv: 0 });
  });
});
