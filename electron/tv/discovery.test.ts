import { createSocket, type Socket } from "node:dgram";
import { afterEach, describe, expect, test } from "vitest";
import {
  REQUEST_BYTES,
  TV_DISCOVERY_PORT,
  broadcastTargets,
  discoverTvs,
  discoveryRequest,
  isPrivateIpv4,
  parseReply,
} from "./discovery";

/**
 * Finding Cyber Place TVs on the club network (2026-11-23). Its own port, far
 * from the PlayStation ports; replies are checked field by field.
 */
const reply = (over: Record<string, unknown> = {}) =>
  Buffer.from(JSON.stringify({ app: "cyberplace-tv", v: 1, env: "staging", code: "123456", maker: "Sony", model: "BRAVIA 4K", ...over }));

describe("the request", () => {
  test("is padded so a TV's reply can never be bigger than the question", () => {
    const r = discoveryRequest();
    expect(r.length).toBe(REQUEST_BYTES);
    expect(r.toString("ascii").startsWith("CPTV-DISCOVER 1")).toBe(true);
  });

  test("uses its own port, none of the PlayStation's", () => {
    expect(TV_DISCOVERY_PORT).toBe(47231);
    expect([987, 9302, 9295, 9296, 9297, 9303, 9304]).not.toContain(TV_DISCOVERY_PORT);
  });
});

describe("a reply", () => {
  test("from a waiting TV on the club network is read", () => {
    expect(parseReply(reply(), "192.168.1.45")).toEqual({
      address: "192.168.1.45", code: "123456", env: "staging", maker: "Sony", model: "BRAVIA 4K",
    });
  });

  test.each([
    ["another app", { app: "other" }],
    ["another version", { v: 2 }],
    ["a code that is not six digits", { code: "12345" }],
    ["a code with letters", { code: "12a456" }],
    ["an unknown environment", { env: "dev" }],
  ])("is ignored when it is %s", (_name, over) => {
    expect(parseReply(reply(over), "192.168.1.45")).toBeNull();
  });

  test("is ignored from outside the club's own network, or when it is not JSON", () => {
    expect(parseReply(reply(), "8.8.8.8")).toBeNull();
    expect(parseReply(Buffer.from("hello"), "192.168.1.45")).toBeNull();
    expect(parseReply(Buffer.alloc(600, 32), "192.168.1.45")).toBeNull();
  });

  test("keeps only printable, short names", () => {
    const tv = parseReply(reply({ maker: "<script>Sony</script>", model: "X".repeat(200) }), "10.0.0.5");
    expect(tv?.maker).toBe("scriptSony/script");
    expect(tv?.model.length).toBe(60);
  });
});

test("private addresses are the club's: 10/8, 172.16/12, 192.168/16, link-local, loopback", () => {
  for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.0.10", "169.254.1.1", "127.0.0.1"]) expect(isPrivateIpv4(ip)).toBe(true);
  for (const ip of ["172.32.0.1", "8.8.8.8", "192.169.1.1", "300.1.1.1", "::1"]) expect(isPrivateIpv4(ip)).toBe(false);
});

test("the request goes to every network's broadcast address and the limited one", () => {
  const targets = broadcastTargets({
    wifi: [{ address: "192.168.1.20", netmask: "255.255.255.0", family: "IPv4", internal: false, mac: "", cidr: null }],
    eth: [{ address: "10.0.5.7", netmask: "255.255.0.0", family: "IPv4", internal: false, mac: "", cidr: null }],
    lo: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true, mac: "", cidr: null }],
  } as never);
  expect(targets.sort()).toEqual(["10.0.255.255", "192.168.1.255", "255.255.255.255"]);
});

describe("over a real socket", () => {
  let tv: Socket | null = null;
  afterEach(() => { tv?.close(); tv = null; });

  const fakeTv = async (answer: (msg: Buffer) => Buffer | null): Promise<number> => {
    const s = createSocket("udp4");
    tv = s;
    s.on("message", (msg, rinfo) => {
      const out = answer(msg);
      if (out) s.send(out, rinfo.port, rinfo.address);
    });
    await new Promise<void>((res) => s.bind(0, "127.0.0.1", () => res()));
    return s.address().port;
  };

  test("a waiting TV answers and is found", async () => {
    const seen: number[] = [];
    const port = await fakeTv((msg) => { seen.push(msg.length); return reply({ code: "654321" }); });
    const found = await discoverTvs({ targets: ["127.0.0.1"], port, timeoutMs: 300 });
    expect(seen).toEqual([REQUEST_BYTES]);
    expect(found).toEqual([{ address: "127.0.0.1", code: "654321", env: "staging", maker: "Sony", model: "BRAVIA 4K" }]);
  });

  test("silence and nonsense find nothing, and nothing throws", async () => {
    const port = await fakeTv(() => Buffer.from("not json"));
    expect(await discoverTvs({ targets: ["127.0.0.1"], port, timeoutMs: 300 })).toEqual([]);
    expect(await discoverTvs({ targets: ["127.0.0.1"], port: 9, timeoutMs: 300 })).toEqual([]);
  });
});
