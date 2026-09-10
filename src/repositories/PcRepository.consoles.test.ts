import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Which places the console finder is allowed to offer.
 *
 * `pcs.kind` says `ps` for every device with no kiosk agent — a PlayStation,
 * and equally a ping-pong table and a poker table, which are billing-only in
 * exactly the same way. Offering those in the "attach this console to…" list
 * invites an operator to pair a games console with furniture, and the wake
 * command would then be aimed at it.
 *
 * The backend refuses the mistake; this is what stops it being offered.
 */

const listed = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock("@/api/pcs", () => ({
  apiListPcsForBranch: vi.fn(async () => listed),
  apiCreatePc: vi.fn(),
  apiDeletePc: vi.fn(),
  apiUpdatePc: vi.fn(),
  apiRotatePcToken: vi.fn(),
  apiBindConsole: vi.fn(),
  apiUnbindConsole: vi.fn(),
}));

const device = (id: number, label: string, platform: string | null) => ({
  id, branch_id: 1, place_id: platform ? id : null, label, kind: "ps",
  status: "online", is_startable: true,
  place: platform ? { id, number: id, name: label, type: "standard", platform } : null,
});

let pcRepository: typeof import("./PcRepository").pcRepository;

beforeEach(async () => {
  ({ pcRepository } = await import("./PcRepository"));
});

describe("the devices a console may be attached to", () => {
  test("offers PlayStation places and nothing else", async () => {
    listed.data = [
      device(1, "PS5 VIP", "ps5"),
      device(2, "PS4 corner", "ps4"),
      device(3, "Table 3", "table-tennis"),
      device(4, "Poker table", "poker"),
      device(5, "VR booth", "vr"),
    ];

    const offered = await pcRepository.listConsoleDevices(1);

    expect(offered.map((d) => d.label)).toEqual(["PS5 VIP", "PS4 corner"]);
  });

  test("a future console generation is offered without a code change", async () => {
    listed.data = [device(1, "PS6 VIP", "ps6")];

    expect((await pcRepository.listConsoleDevices(1)).map((d) => d.label)).toEqual(["PS6 VIP"]);
  });

  test("a custom platform that merely mentions ps is not a console place", async () => {
    // The shape of the slug decides, not whether the letters appear in it.
    listed.data = [device(1, "PS5 VR corner", "ps5-vr"), device(2, "Retro PS corner", "retro-ps-corner")];

    expect(await pcRepository.listConsoleDevices(1)).toEqual([]);
  });

  test("a device serving no place is not offered", async () => {
    // Nothing says what it is, so nothing can establish what binding to it means.
    listed.data = [device(1, "Orphan", null)];

    expect(await pcRepository.listConsoleDevices(1)).toEqual([]);
  });
});
