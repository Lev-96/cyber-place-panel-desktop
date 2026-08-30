import { createSocket, type Socket } from "node:dgram";
import { afterEach, describe, expect, test } from "vitest";
import { discover, probe } from "../../electron/ps5/discovery";
import { PS_DISCOVERY_PORT } from "../../electron/ps5/protocol";

/**
 * Discovery against consoles that do not exist.
 *
 * A real PS5 cannot be part of CI, so this stands one up: a UDP responder
 * bound to the real discovery port on loopback, answering a real probe the way
 * the protocol says a console does. Everything that is ours is exercised for
 * real — the packet we send, the sweep, the parse, keying by host id, several
 * consoles at once, and silence.
 *
 * ## Why these probe loopback and never broadcast
 * The suite has to give the same answer in CI, on a laptop at home, and on a
 * machine sitting in a club — and in a club a broadcast is answered by every
 * real console in the building. A test that asserted "one console was found"
 * would then fail with six, which says nothing about the code. So the sweep is
 * pointed at 127.0.0.1 and the assertions name the fake console by its host id
 * rather than counting the whole result.
 *
 * What none of this proves is that a real console answers this way. That is a
 * separate gate, with hardware.
 */

let fake: Socket | null = null;

/**
 * A responder on 127.0.0.1:9302 that replies with each console it was given.
 *
 * One socket answering for several consoles rather than several sockets: only
 * one process can hold the discovery port on an address, and this is also
 * exactly what a switch does when several consoles answer one broadcast.
 */
const fakeConsoles = async (
  consoles: Array<{ hostId: string; name: string; status: string }>,
): Promise<void> => {
  const socket = createSocket({ type: "udp4", reuseAddr: true });
  fake = socket;

  socket.on("message", (_message, remote) => {
    for (const console_ of consoles) {
      const answer = [
        `HTTP/1.1 ${console_.status}`,
        `host-id:${console_.hostId}`,
        "host-type:PS5",
        `host-name:${console_.name}`,
        "device-discovery-protocol-version:00030010",
        "system-version:07000001",
        "",
      ].join("\n");
      socket.send(Buffer.from(answer, "utf8"), remote.port, remote.address);
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(PS_DISCOVERY_PORT, "127.0.0.1", resolve);
  });
};

afterEach(() => {
  if (fake) { try { fake.close(); } catch { /* already closed */ } fake = null; }
});

describe("a discovery sweep", () => {
  test("finds a console, reads its identity and its state", async () => {
    await fakeConsoles([{ hostId: "AABBCC001122", name: "PS5-VIP-01", status: "200 Ok" }]);

    const result = await probe(["127.0.0.1"], 800);

    const found = result.consoles.find((c) => c.hostId === "AABBCC001122")!;
    expect(found).toBeDefined();
    expect(found.name).toBe("PS5-VIP-01");
    expect(found.state).toBe("awake");
    expect(found.address).toBe("127.0.0.1");
  });

  test("a resting console reads as resting — the state it can be woken from", async () => {
    await fakeConsoles([{ hostId: "DDEEFF", name: "PS5-02", status: "620 Server Standby" }]);

    const result = await probe(["127.0.0.1"], 800);

    expect(result.consoles.find((c) => c.hostId === "DDEEFF")!.state).toBe("rest");
  });

  test("three consoles are three consoles, each with its own identity", async () => {
    await fakeConsoles([
      { hostId: "AAA", name: "PS5-01", status: "200 Ok" },
      { hostId: "BBB", name: "PS5-02", status: "620 Server Standby" },
      { hostId: "CCC", name: "PS5-03", status: "620 Server Standby" },
    ]);

    const result = await probe(["127.0.0.1"], 900);

    const ours = result.consoles.filter((c) => ["AAA", "BBB", "CCC"].includes(c.hostId));
    expect(ours.map((c) => c.hostId).sort()).toEqual(["AAA", "BBB", "CCC"]);
    // Independent state per console: starting a session on #02 must never be
    // decided by what #01 happens to be doing.
    expect(result.consoles.find((c) => c.hostId === "AAA")!.state).toBe("awake");
    expect(result.consoles.find((c) => c.hostId === "BBB")!.state).toBe("rest");
  });

  test("a console answering twice is still one console", async () => {
    // What a machine with two interfaces on the same LAN produces.
    await fakeConsoles([
      { hostId: "SAME", name: "PS5-01", status: "200 Ok" },
      { hostId: "SAME", name: "PS5-01", status: "200 Ok" },
    ]);

    const result = await probe(["127.0.0.1"], 800);

    expect(result.consoles.filter((c) => c.hostId === "SAME")).toHaveLength(1);
  });

  test("a direct probe reaches a named console without touching the network", async () => {
    await fakeConsoles([{ hostId: "DIRECT01", name: "PS5-VIP-01", status: "200 Ok" }]);

    const result = await probe(["127.0.0.1"], 800);

    expect(result.consoles.map((c) => c.hostId)).toEqual(["DIRECT01"]);
    // The point of the unicast path: exactly the addresses asked for, and no
    // broadcast address anywhere near it. A ten-second timer that shouted at
    // the whole club would be a different feature.
    expect(result.probed).toEqual(["127.0.0.1"]);
  });

  test("a probe returns as soon as everyone it asked has answered", async () => {
    await fakeConsoles([{ hostId: "QUICK01", name: "PS5-01", status: "200 Ok" }]);

    const started = Date.now();
    const result = await probe(["127.0.0.1"], 5_000);
    const took = Date.now() - started;

    expect(result.consoles.map((c) => c.hostId)).toEqual(["QUICK01"]);
    // The status check runs every ten seconds all shift. Sitting out a five
    // second timeout after the answer already arrived would make each check
    // cost fifty times what it needs to.
    expect(took).toBeLessThan(1_000);
  });

  test("probing nothing is not an error and sends nothing", async () => {
    // The normal state of a branch with no console bound yet. It must not
    // open a socket, and it must not look like a failure.
    const result = await probe([], 800);

    expect(result).toEqual({ consoles: [], probed: [], warnings: [] });
  });

  test("a probe reports silence rather than inventing a state", async () => {
    // A loopback address nothing is bound to. Deliberately not 127.0.0.1: a
    // developer running a console simulator holds that one, and a test whose
    // meaning depends on what else happens to be running is not a test.
    const result = await probe(["127.0.0.9"], 400);

    expect(result.consoles).toEqual([]);
    expect(result.probed).toEqual(["127.0.0.9"]);
  });

  test("silence is an empty list, not an error", async () => {
    // Nothing is bound to the discovery port here — the state of a venue with
    // no console at all. It must produce a screen that says so, never a thrown
    // exception in front of the owner.
    const result = await probe(["127.0.0.9"], 400);

    expect(result.consoles).toEqual([]);
  });

  test("the sweep always ends, within its timeout", async () => {
    const started = Date.now();
    await discover({ timeoutMs: 300 });
    const took = Date.now() - started;

    expect(took).toBeGreaterThanOrEqual(250);
    expect(took).toBeLessThan(3_000);
  });

  test("it reports where it looked, so a silent network can be diagnosed", async () => {
    const result = await discover({ timeoutMs: 300, extraTargets: ["127.0.0.1"] });

    expect(result.probed).toContain("127.0.0.1");
    expect(result.probed).toContain("255.255.255.255");
  });
});
