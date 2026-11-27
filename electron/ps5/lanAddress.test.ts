import { describe, expect, test } from "vitest";
import { isLanAddress } from "./lanAddress";

/** A PlayStation datagram goes only to the club's own network (2026-11-28). */
describe("isLanAddress", () => {
  test("the club's own network", () => {
    for (const a of ["192.168.1.35", "10.0.0.7", "172.16.4.2", "172.31.255.254", "169.254.10.3", "100.64.0.9", "100.127.1.1", "127.0.0.1"]) {
      expect(isLanAddress(a)).toBe(true);
    }
  });
  test("never the internet, a name, IPv6 or junk", () => {
    for (const a of ["81.2.69.142", "8.8.8.8", "172.15.0.1", "172.32.0.1", "192.167.1.1", "100.63.0.1", "100.128.0.1", "ps5.local",
      "evil.example", "::1", "fe80::1", "192.168.1", "192.168.1.256", "192.168.1.35 ", " 10.0.0.1x", "", null, 42, undefined]) {
      expect(isLanAddress(a)).toBe(false);
    }
  });
});
