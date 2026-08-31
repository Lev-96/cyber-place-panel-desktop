import { describe, expect, test } from "vitest";
import { credentialFromRegistKey, wakePacket } from "../../electron/ps5/wake";

/**
 * The wake datagram, byte for byte.
 *
 * This packet has never been answered by a real console — there has been no
 * registration key to put in one. So the only thing that can be checked without
 * hardware is that it is EXACTLY the packet Sony's own protocol expects, and
 * that is what this does: the format is transcribed from the reference open
 * client (chiaki's `chiaki_discovery_packet_fmt`), and any drift from it shows
 * up here rather than as a console that silently ignores us in a venue.
 *
 * A console checks these headers and drops a packet shaped differently, which
 * is why every one of them is pinned, including the line endings.
 */

describe("the credential a console will accept", () => {
  test("a registration key is the unsigned integer its hex spells", () => {
    // The key arrives as ASCII hex from pairing; the packet carries the number.
    expect(credentialFromRegistKey("1A2B3C4D")).toBe(0x1a2b3c4dn);
    expect(credentialFromRegistKey("ffffffff")).toBe(4_294_967_295n);
    expect(credentialFromRegistKey("00000001")).toBe(1n);
  });

  test("case and stray whitespace are what a copy-paste produces, and are fine", () => {
    expect(credentialFromRegistKey("  1a2b3c4d  ")).toBe(0x1a2b3c4dn);
    expect(credentialFromRegistKey("1A2b3C4d")).toBe(0x1a2b3c4dn);
  });

  test("anything that is not a registration key is refused, not sent", () => {
    // Refusing here is what turns "the console ignores us forever" into a
    // sentence the operator can act on.
    expect(credentialFromRegistKey("")).toBeNull();
    expect(credentialFromRegistKey("nothex!!")).toBeNull();
    // Longer than eight characters is not this kind of key — the reference
    // client refuses the same thing.
    expect(credentialFromRegistKey("1234567890")).toBeNull();
    expect(credentialFromRegistKey("12 34")).toBeNull();
  });
});

describe("the datagram", () => {
  const text = (key: string) => wakePacket(credentialFromRegistKey(key)!).toString("utf8");

  test("it is the exact packet the protocol defines", () => {
    // Field order, spelling and the trailing newline all matter: a console
    // parses this as a header block and drops what it does not recognise.
    expect(text("1A2B3C4D")).toBe(
      "WAKEUP * HTTP/1.1\n" +
      "client-type:vr\n" +
      "auth-type:R\n" +
      "model:w\n" +
      "app-type:r\n" +
      "user-credential:439041101\n" +
      "device-discovery-protocol-version:00030010\n",
    );
  });

  test("the credential travels as decimal, not as the hex it was typed in", () => {
    // The single easiest thing to get wrong, and it fails silently on the wire:
    // 0x1A2B3C4D is 439041101, and a console handed "1A2B3C4D" simply ignores
    // the packet.
    expect(text("1A2B3C4D")).toContain("user-credential:439041101\n");
    expect(text("1A2B3C4D")).not.toContain("1A2B3C4D");
  });

  test("lines end with \\n, never \\r\\n", () => {
    // It looks like HTTP and is not: the reference client writes bare newlines,
    // and a console fed CRLF does not answer.
    expect(text("00000001")).not.toContain("\r");
  });

  test("the protocol version is the PS5 one", () => {
    expect(text("00000001")).toContain("device-discovery-protocol-version:00030010\n");
  });
});
