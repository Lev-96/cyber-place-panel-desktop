import { describe, expect, test } from "vitest";
import { parseDiscoveryResponse, probePacket } from "../../electron/ps5/protocol";
import { discoveryLanes } from "../../electron/ps5/discovery";

/**
 * The parser is the part of PS5 discovery that has to be right without a
 * console in the room: everything downstream — which place is bound to which
 * console, whether the board says awake or asleep — rests on reading one
 * datagram correctly.
 *
 * The samples below are the shapes third-party clients report. If a real
 * console answers differently, THESE are what change, and the failure is
 * visible here rather than as a wrong console being woken in a club.
 */

const awake = [
  "HTTP/1.1 200 Ok",
  "host-id:0011223344AA",
  "host-type:PS5",
  "host-name:PS5-VIP-01",
  "host-request-port:997",
  "device-discovery-protocol-version:00030010",
  "system-version:07000001",
  "",
].join("\n");

const resting = [
  "HTTP/1.1 620 Server Standby",
  "host-id:0011223344BB",
  "host-type:PS5",
  "host-name:PS5-02",
  "device-discovery-protocol-version:00030010",
  "",
].join("\n");

describe("the probe we send", () => {
  test("is the SRCH request a console expects, terminated like a header block", () => {
    const text = probePacket().toString("utf8");

    expect(text.startsWith("SRCH * HTTP/1.1")).toBe(true);
    expect(text).toContain("device-discovery-protocol-version:");
    // The console reads it as headers and wants the blank line.
    expect(text.endsWith("\n\n")).toBe(true);
  });
});

describe("reading a console's answer", () => {
  test("an awake console", () => {
    const found = parseDiscoveryResponse(awake, "192.168.1.30");

    expect(found).not.toBeNull();
    expect(found!.state).toBe("awake");
    expect(found!.hostId).toBe("0011223344AA");
    expect(found!.name).toBe("PS5-VIP-01");
    expect(found!.type).toBe("PS5");
    expect(found!.address).toBe("192.168.1.30");
    expect(found!.systemVersion).toBe("07000001");
  });

  test("a console in rest mode — the only state it can be woken from", () => {
    expect(parseDiscoveryResponse(resting, "192.168.1.31")!.state).toBe("rest");
  });

  test("a status we have never seen is `unknown`, not a guess", () => {
    const odd = parseDiscoveryResponse("HTTP/1.1 599 Something New\nhost-id:X\n", "10.0.0.5");

    // Reported, visible, and honestly labelled: the protocol moved, the
    // console did not go anywhere.
    expect(odd!.state).toBe("unknown");
    expect(odd!.hostId).toBe("X");
  });

  test("an answer with no host id is not a console we can bind to", () => {
    // Without an identity there is nothing stable to attach a place to, and
    // inventing one would break the next time the console reboots.
    expect(parseDiscoveryResponse("HTTP/1.1 200 Ok\nhost-type:PS5\n", "10.0.0.5")).toBeNull();
  });

  test("noise on the network is ignored rather than mistaken for a console", () => {
    expect(parseDiscoveryResponse("hello?", "10.0.0.9")).toBeNull();
    expect(parseDiscoveryResponse("", "10.0.0.9")).toBeNull();
    expect(parseDiscoveryResponse("M-SEARCH * HTTP/1.1\nST:upnp:rootdevice", "10.0.0.9")).toBeNull();
  });

  test("the name falls back to the id, so a console is never nameless in a list", () => {
    const found = parseDiscoveryResponse("HTTP/1.1 200 Ok\nhost-id:ABC123\n", "10.0.0.5");

    expect(found!.name).toBe("ABC123");
  });

  test("headers are read case-insensitively and keep their raw form for diagnosis", () => {
    const found = parseDiscoveryResponse("HTTP/1.1 200 Ok\nHOST-ID:AA\nHost-Name:Corner\n", "10.0.0.5");

    expect(found!.hostId).toBe("AA");
    expect(found!.name).toBe("Corner");
    expect(found!.raw["host-name"]).toBe("Corner");
  });
});

describe("where the probe is sent", () => {
  const iface = (address: string, netmask: string, internal = false) =>
    [{ address, netmask, family: "IPv4", internal } as never];

  test("one lane per usable interface, bound to it, aimed at its own broadcast", () => {
    const { lanes } = discoveryLanes({
      lo: iface("127.0.0.1", "255.0.0.0", true),
      eth0: iface("192.168.1.20", "255.255.255.0"),
      wlan0: iface("10.4.2.7", "255.255.0.0"),
    });

    // Derived, not assumed: a club on 10.x is as likely as one on 192.168.x.
    expect(lanes).toEqual([
      { label: "eth0 192.168.1.20", bind: "192.168.1.20", targets: ["192.168.1.255", "255.255.255.255"] },
      { label: "wlan0 10.4.2.7", bind: "10.4.2.7", targets: ["10.4.255.255", "255.255.255.255"] },
    ]);
  });

  test("the console LAN with no gateway beside a USB modem: both are swept, each out of its own interface", () => {
    // The field case (2026-10-18). Names are whatever Windows calls them; the
    // choice never depends on them.
    const { lanes } = discoveryLanes({
      "Ethernet": iface("192.168.1.50", "255.255.255.0"),
      "Remote NDIS based Internet Sharing Device": iface("192.168.42.129", "255.255.255.0"),
    });

    expect(lanes.map((l) => l.bind)).toEqual(["192.168.1.50", "192.168.42.129"]);
    expect(lanes[0].targets).toContain("192.168.1.255");
  });

  test("loopback, link-local and point-to-point (VPN) links are skipped, and say why", () => {
    const { lanes, skipped } = discoveryLanes({
      lo: iface("127.0.0.1", "255.0.0.0", true),
      apipa: iface("169.254.10.3", "255.255.0.0"),
      tun0: iface("100.101.7.3", "255.255.255.255"),
      ppp0: iface("10.8.0.6", "255.255.255.254"),
    });

    expect(lanes).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual(["loopback", "link-local", "point-to-point", "point-to-point"]);
  });

  test("the same address twice is one lane", () => {
    const { lanes } = discoveryLanes({ a: iface("192.168.1.20", "255.255.255.0"), b: iface("192.168.1.20", "255.255.255.0") });
    expect(lanes).toHaveLength(1);
  });

  test("a machine with no usable interface has no lanes; the sweep falls back to one unbound socket", () => {
    expect(discoveryLanes({}).lanes).toEqual([]);
  });
});
