import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The panel half of the realtime wire contract.
 *
 * The backend pins its side in tests/Unit/Events/BroadcastContractTest.php.
 * This file pins ours, and the two lists must be kept identical by hand —
 * that is the whole point. Neither side can fail loudly on its own: a renamed
 * event simply never fires, a renamed channel silently subscribes to nothing,
 * and a removed payload key reads as `undefined`. The board stops updating and
 * nothing throws.
 *
 * That failure mode is not hypothetical. The mobile app's own notes claim it
 * listens for `branch.subscribed` and `tournament.joined`; it binds neither,
 * and nothing caught it because only one of the eight events had a test.
 *
 * Rather than refactor working realtime code onto shared constants — which
 * would risk the very thing it is meant to protect — this asserts over the
 * SOURCE. It reads every binding literal out of src/ and compares the set to
 * the contract below.
 *
 * WHEN THIS FAILS: either the backend contract changed and this list must
 * follow in the same commit, or someone renamed a binding here and the
 * backend does not know. Do not "fix" it by editing the list alone.
 *
 * Backend side of the pairing:
 *   /var/www/html/cyber-place/tests/Unit/Events/BroadcastContractTest.php
 */

/**
 * Backend events this panel deliberately does NOT bind.
 *
 * Kept here so the list below stays readable as "what the panel listens to"
 * rather than drifting into "what exists". A phone-only event is not a gap:
 *
 *  - `.branch.platforms.changed` — the mobile booking screen's platform tabs.
 *    The panel edits places through its own screens, which reload themselves.
 */
const PUBLISHED_BUT_NOT_BOUND_HERE = [".branch.platforms.changed"] as const;

/** Event aliases this panel binds, in Echo's leading-dot form. */
const CONTRACT_EVENTS = [
  ".access.changed",
  ".app-release.available",
  ".app-update.promoted",
  ".booking.changed",
  ".branch.subscribed",
  ".branch.visibility.changed",
  ".notification.created",
  ".place.availability.changed",
  ".tournament.joined",
] as const;

/**
 * Channel name shapes. `{...}` marks the interpolated part.
 *
 * Public channels are read with `echo.channel(name)`; private ones with
 * `echo.private(name)` — and note the client passes the name WITHOUT the
 * `private-` prefix that appears on the wire, because Echo adds it.
 */
const CONTRACT_CHANNELS = {
  // What THIS client subscribes to. The public `branch.{id}` still exists on
  // the backend and still carries a `booking.changed` — but a person-free one,
  // for the mobile app's guest token. The panel has no use for it: staff need
  // the guest's name and the booking code, and those are private-only.
  // `branches` is the catalogue feed: which venues an administrator just closed
  // or reopened, as two lists of ids. Public because its other audience is the
  // mobile app on a guest token, which cannot authorise a private channel —
  // acceptable only because the payload names no person and no place.
  public: ["app-updates", "app-updates.{role}", "branches"],
  // Every staff feed is authorised as of 2026-08-18. A public Pusher channel is
  // never authorised at all, so the app key shipped in each bundle was the
  // whole of the access control on the platform's bookings.
  private: [
    "user.{id}.notifications",
    "user.{id}.access",
    "bookings.global",
    "company.{id}",
    "branch.{id}",
  ],
} as const;

const SRC = path.resolve(__dirname, "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry)) return [];
    // Test files quote these names while asserting on them.
    if (/\.test\.tsx?$/.test(entry)) return [];
    return [full];
  });

const allSource = (): { file: string; text: string }[] =>
  sourceFiles(SRC).map((file) => ({ file: path.relative(SRC, file), text: readFileSync(file, "utf8") }));

describe("realtime event bindings", () => {
  const listened = new Map<string, string[]>();

  for (const { file, text } of allSource()) {
    for (const m of text.matchAll(/\.listen\(\s*"(\.[^"]+)"/g)) {
      const name = m[1];
      listened.set(name, [...(listened.get(name) ?? []), file]);
    }
  }

  it("binds exactly the events it should — no more, no fewer", () => {
    const found = [...listened.keys()].sort();

    expect(found).toEqual([...CONTRACT_EVENTS].sort());
  });

  it("stops listening to every event it listens to", () => {
    // A listener without a matching stopListening leaks across channel
    // rotation, so the same payload gets handled twice after a branch switch.
    for (const { text } of allSource()) {
      for (const m of text.matchAll(/\.listen\(\s*"(\.[^"]+)"/g)) {
        expect(text).toContain(`stopListening("${m[1]}"`);
      }
    }
  });

  it("keeps the leading dot, which is what selects a custom broadcastAs name", () => {
    // Without it Echo looks for the fully-qualified PHP class name instead,
    // and the subscription silently never fires.
    for (const name of listened.keys()) {
      expect(name.startsWith(".")).toBe(true);
    }
  });
});

describe("realtime channel names", () => {
  const files = allSource();

  /** Files whose source matches — reported by name so a failure is readable. */
  const filesMatching = (re: RegExp): string[] =>
    files.filter((f) => re.test(f.text)).map((f) => f.file);

  it("subscribes to the three role-scoped booking channels", () => {
    // admin → bookings.global, owner → company.{id}, manager → branch.{id}.
    // BookingChanged lands on all three so each role reads the narrowest one.
    expect(filesMatching(/bookings\.global/).length, "bookings.global").toBeGreaterThan(0);
    expect(filesMatching(/`company\.\$\{[^}]+\}`/).length, "company.{id}").toBeGreaterThan(0);
    expect(filesMatching(/`branch\.\$\{[^}]+\}`/).length, "branch.{id}").toBeGreaterThan(0);
  });

  it("resolves the booking channel in exactly one place", () => {
    // Home.tsx and useReservedPlaceIds each used to hardcode `bookings.global`
    // for every role and filter by branch_id on the client, which is not
    // scoping: the payload had already been delivered. The name is built in
    // bookingScope.ts now, and nowhere else may build one.
    const builders = files.filter(
      (f) => /bookings\.global/.test(f.text) && !/bookingScope\.ts$/.test(f.file),
    );

    for (const f of builders) {
      expect(
        /^\s*(\/\/|\*)/m.test(f.text.split("\n").find((l) => l.includes("bookings.global")) ?? ""),
        `${f.file} names bookings.global outside bookingScope.ts — route it through resolveBookingScopeChannel instead`,
      ).toBe(true);
    }
  });

  it("subscribes to the staff feeds privately", () => {
    // The hooks take an isPrivate flag; the resolver is what sets it. If this
    // ever reads false for admin/owner the subscription silently falls back to
    // the public channel, which still exists during the migration — so it would
    // keep working while leaking exactly as before.
    const scope = files.find((f) => /bookingScope\.ts$/.test(f.file));
    expect(scope, "src/realtime/bookingScope.ts is missing").toBeDefined();
    expect(scope!.text).toMatch(/bookings\.global["'`],?\s*isPrivate:\s*true/);
    expect(scope!.text).toMatch(/company\.\$\{companyId\}`,\s*isPrivate:\s*true/);
    expect(scope!.text).toMatch(/branch\.\$\{branchId\}`,\s*isPrivate:\s*true/);
  });

  it("subscribes to the catalogue feed", () => {
    // Where a block applied on another machine reaches this panel. Without it
    // the branch list keeps a closed venue on screen until a manual reload.
    expect(filesMatching(/echo\.channel\(\s*"branches"\s*\)/).length, "branches").toBeGreaterThan(0);
  });

  it("subscribes to the shared update channel", () => {
    expect(filesMatching(/echo\.channel\(\s*"app-updates"\s*\)/).length, "app-updates").toBeGreaterThan(0);
  });

  it("names all three role update channels exactly as the backend suffixes them", () => {
    // AppReleaseAvailable broadcasts on `app-updates.{role}` where role is one
    // of its ROLE_ADMIN / ROLE_OWNER / ROLE_MANAGER constants — 'admin',
    // 'company_owner', 'manager'. These are written out one per role here
    // rather than interpolated, so each is pinned literally.
    for (const role of ["admin", "company_owner", "manager"]) {
      expect(
        filesMatching(new RegExp(`"app-updates\\.${role}"`)).length,
        `app-updates.${role} — must match the backend ROLE_* constant exactly`
      ).toBeGreaterThan(0);
    }
  });

  it("reads both authorised channels through echo.private()", () => {
    // The channel name is sometimes built into a variable first, so this
    // checks per file: whichever file names the channel must also be the one
    // calling .private() on it.
    for (const shape of [/user\.\$\{[^}]+\}\.access/, /user\.\$\{[^}]+\}\.notifications/]) {
      const named = files.filter((f) => shape.test(f.text));
      expect(named.length, `no file builds ${shape}`).toBeGreaterThan(0);

      for (const f of named) {
        expect(f.text, `${f.file} names a private channel but never calls echo.private()`).toMatch(/\.private\(/);
      }
    }
  });

  it("never writes the wire-side private- prefix on the client", () => {
    // Echo adds it. Writing it here yields `private-private-user.1.access`,
    // which authorises nothing and receives nothing.
    expect(filesMatching(/\.private\(\s*[`"]private-/), "must be empty").toEqual([]);
  });

  it("never subscribes to a user channel with echo.channel()", () => {
    // That skips /broadcasting/auth entirely and simply never receives.
    expect(filesMatching(/\.channel\(\s*`user\./), "must be empty").toEqual([]);
  });
});

describe("contract documentation", () => {
  it("lists the same number of events the backend pins", () => {
    // Guards against someone adding a binding here and forgetting the
    // backend, or vice versa. Nine bound here plus one published for the phones
    // only, verified 2026-08-29: `.branch.visibility.changed` joined with the
    // player-facing half of a block, `.branch.platforms.changed` with the
    // booking screen's live platform tabs.
    expect(CONTRACT_EVENTS).toHaveLength(9);
    expect(PUBLISHED_BUT_NOT_BOUND_HERE).toHaveLength(1);
    // The backend pins 11 in tests/Unit/Events/BroadcastContractTest.php:
    // the nine below, the mobile-only one above, and BookingChangedPublic,
    // which shares the `.booking.changed` alias with its private twin.
    expect(CONTRACT_EVENTS.length + PUBLISHED_BUT_NOT_BOUND_HERE.length + 1).toBe(11);
    // 3 public / 5 private since 2026-08-28: the two update feeds plus the
    // catalogue feed this panel joined for block state. The staff feeds moved
    // to private on 2026-08-18 — during that migration the backend still ALSO
    // broadcasts them publicly, so an un-updated panel keeps working; when the
    // public pair is dropped nothing here changes, this side already reads the
    // private one.
    expect(CONTRACT_CHANNELS.public).toHaveLength(3);
    expect(CONTRACT_CHANNELS.private).toHaveLength(5);
  });
});
