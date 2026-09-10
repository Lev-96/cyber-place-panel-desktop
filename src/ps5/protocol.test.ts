import { describe, expect, test } from "vitest";
import { parseDiscoveryResponse, probePacket } from "../../electron/ps5/protocol";
import { broadcastTargets } from "../../electron/ps5/discovery";

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
  test("broadcast addresses come from the machine's own interfaces", () => {
    const targets = broadcastTargets({
      lo: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true } as never],
      eth0: [{ address: "192.168.1.20", netmask: "255.255.255.0", family: "IPv4", internal: false } as never],
      wlan0: [{ address: "10.4.2.7", netmask: "255.255.0.0", family: "IPv4", internal: false } as never],
    });

    // Derived, not assumed: a club on 10.x is as likely as one on 192.168.x.
    expect(targets).toContain("192.168.1.255");
    expect(targets).toContain("10.4.255.255");
    // Loopback would only ever probe ourselves.
    expect(targets).not.toContain("127.255.255.255");
    // The global fallback, for an interface with no usable broadcast of its own.
    expect(targets).toContain("255.255.255.255");
  });

  test("a machine with no usable interface still has somewhere to send", () => {
    expect(broadcastTargets({})).toEqual(["255.255.255.255"]);
  });
});
