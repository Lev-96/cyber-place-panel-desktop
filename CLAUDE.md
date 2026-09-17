# cyber-place-panel-desktop — Working Notes for Claude

> Staff panel (admins, owners, managers). Electron 33 + Vite 5.4 + React 19, TypeScript strict.
> Source of truth for THIS project. Cross-project context is in section 2.
> When code and this doc disagree, **trust the code first, then update this doc**.
> Last verified: 2026-05-28.

---

## 1. What this app is

Electron desktop panel used by gaming-venue staff to manage bookings,
sessions, places (PCs/consoles), tournaments, billing, POS, members, and
live floor monitoring. Distributed as Linux AppImage, Windows NSIS, macOS
DMG (x64 + arm64), ASAR enabled. Auto-updates via `electron-updater` from
GitHub releases.

Talks to the Laravel backend (`cyber-place`) over REST + Reverb WebSocket.
Coordinates with the kiosk agent (`cyber-place-panel-desktop-agent`) via the
backend (no direct desktop↔agent transport — backend brokers everything).

---

## 2. The Cyber Place ecosystem (read-only map for context)

| Project | Path | Role |
|---|---|---|
| `cyber-place` | `/var/www/html/cyber-place/` | Laravel 10.50 backend (REST + Reverb), Sanctum, MySQL, Expo push |
| `CyberPlace-mob` | `/var/www/html/CyberPlace-mob/` | Customer mobile app (Expo SDK 54, RN 0.81) |
| **`cyber-place-panel-desktop`** (this one) | `/var/www/html/cyber-place-panel-desktop/` | Staff Electron panel |
| `cyber-place-panel-desktop-agent` | `/var/www/html/cyber-place-panel-desktop-agent/` | Kiosk Electron agent on each gaming PC |
| `cyber-place-panel-website` | `/var/www/html/cyber-place-panel-website/` | Public landing (static HTML/JS/CSS) |

When changing a contract (API endpoint, broadcast event/channel, booking
status, push payload), update every affected project in the **same**
change. Never silently drift the staff side away from mobile or backend.

---

## 2.5 Branches, environments & deploy (READ BEFORE COMMITTING)

**Branch workflow — applies to every Cyber Place repo:**
- **All changes go to the `staging` branch first.** Never commit or push
  straight to the production branch.
- Production branch is **`master`** for the backend (`cyber-place`), both
  desktops (`-panel-desktop`, `-panel-desktop-agent`) and the website
  (`-panel-website`); it is **`main`** only for the mobile app
  (`CyberPlace-mob`). The staging branch is named `staging` in every repo.
- The user reviews on `staging`, then **promotes to production himself**
  (merges `staging` → the prod branch). Do not open or merge that PR
  unless explicitly asked.

**Releases / CI (this desktop):** production and staging coexist in the SAME
GitHub repo, separated by **electron-updater channel + git tag**, not by
branch — so the two yml files never conflict:
- `.github/workflows/release.yml` — production; fires on tags `v*`
  (excludes `v*-staging*`); channel `latest` (`latest*.yml`).
- `.github/workflows/release-staging.yml` — staging; fires on tags
  `v*-staging*`; uses `electron-builder.staging.json` (full standalone copy),
  prerelease, channel `staging` (`staging*.yml`).
- Both workflow files live on both branches and are **tag-driven**.
  `package.json` version MUST equal the tag (incl. `-staging.N`) or the
  backend update gate loops "update available".
- `.env.production` / `.env.staging` are TRACKED on purpose (public Vite
  values, required by CI); build via `npm run build` / `dist:*` (prod) or
  `build:staging` / `dist:*:staging` (staging).

---

## 3. Stack (verified)

- **Electron 33 + Vite 5.4 + React 19** · TypeScript strict mode
- **Router:** `react-router-dom 7` with `HashRouter`, 38+ lazy-loaded routes
- **State:** **React Context only** (`AuthContext`, `LanguageContext`,
  `FxRatesContext`). No Zustand / Redux / React Query.
- **UI:** custom CSS + `theme.ts` (dark by default, `#020514`). Custom
  `Button` primitive. Fonts: Playstation (branding) + Inter (UI text).
- **API client:** native fetch wrapper at `src/api/client.ts` (bearer auth,
  ngrok-skip header).
- **Auth storage:** KV-store abstraction — Electron path uses preload IPC
  (`desktopAPI.kv`) writing to `userData/cyberplace.kv.json`; browser
  fallback uses `localStorage`.
- **Realtime:** `laravel-echo 2.3` + `pusher-js 8.5` against Reverb
  (`VITE_REVERB_*`). Public channel `app-updates`; private channels for
  bookings/sessions/notifications.
- **Tests:** Vitest 4 (unit) + Playwright 1.59 (`e2e/`).
- **Distribution:** `electron-builder 25` → Linux AppImage, Windows NSIS,
  macOS DMG (x64 + arm64), ASAR enabled.
- **Auto-update:** `electron-updater 6.8.3`, GitHub releases provider
  (`Lev-96/cyber-place-panel-desktop`), polled on boot + reacts to
  `app-update.promoted` Reverb event.
- **Code-signing:** Windows installer signed with self-signed Cyber Place
  cert (SmartScreen still warns by design — chosen over EV/OV/Store).
  See `SIGNING.md`.

### Electron security posture (NEVER LOOSEN)
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Preload (`electron/preload.ts`) exposes exactly the contracted APIs via
  `contextBridge`: `desktopAPI` (kv-store + Wake-on-LAN), `cyberplaceUpdates`
  and `cyberplacePS5` (PlayStation discovery + status). Each is its own global
  so a screen can feature-detect it: the renderer can be newer than the preload
  it loads into, and a missing bridge must produce a sentence, not a throw.
- 13 `ipcMain.handle` channels total: `kv:get|set|remove`, `wol:send`,
  `updates:check|install|getState`, `ps5:discover|probe|wake|rest|capabilities`,
  `ps5:credential:set|has|forget`.
- **The console wake key never crosses to the renderer.** It is encrypted by the
  OS keystore (`electron/ps5/credentials.ts`, `safeStorage`), and the bridge can
  be asked *whether* a console has one, never what it is. If the OS offers no
  keystore, storing is refused rather than falling back to readable text.
- **The consoles are talked to from HERE, not from the server.** The backend is
  in a datacentre and shares no broadcast domain with any club; this process
  runs on a machine in the room. `electron/ps5/` is read-only by construction —
  it can find a console and report what it said, and it cannot wake or rest one.
  `ps5:discover` sweeps the network and belongs behind a button; `ps5:probe`
  asks named addresses and is what the ten-second status check on the sessions
  board uses (`src/ps5/useConsoleWatch.ts`). A broadcast every ten seconds would
  put a packet in front of every device in the venue all shift.
- **`electron/ps5/transport.ts` is the seam.** It declares what a transport can
  do, and today's answers `rest: false` — the local protocol has no rest
  command; that needs a Remote Play session (TCP 9295, a key exchange). The
  refusal is a value (`UNSUPPORTED_BY_TRANSPORT`) that reaches the screen. It is
  never a success nothing earned, and swapping in a rest-capable transport
  changes no logic above it.

### The console lifecycle (`src/ps5/`)
`machine.ts` is a pure function of (previous state, observation) → (next state,
commands): UNKNOWN / OFFLINE / REST / WAKING / ACTIVE / GOING_TO_REST /
UNEXPECTED_WAKE / ERROR, with `desired` kept apart from `actual`. Everything
racy about this feature is a question about that function, and is asked of it
directly in `machine.test.ts` with no console anywhere.

**STARTING and STOPPING are NOT session statuses.** `gaming_sessions.status` is
`active | stopped | expired` and feeds billing, revenue and every client; a
session that is "starting" is this panel's own intent for the seconds between
Start being pressed and the console answering. It lives in
`useConsoleControl.ts` — which is what stops the monitor seeing "awake, no
session yet" and switching the console off under the player, without touching a
schema three clients read.

State is recomputed from the current observation every tick, never from a timer.
That is why a stale ten-second countdown cannot fire into a session that started
meanwhile: there is no timer left to fire.
- Custom `app://` protocol — no `file://` disclosure.

### Feature areas (folders under `src/`)
`bookings · branches · companies · games · live · managers · members · pcs ·
pos · places · ps5 · sessions · tournaments · revenue · services · scanner`

---

## 4. Universal coding standards (apply here too)

- **Analyse before editing.** Read the file end-to-end, grep for usages of
  symbols being changed, state the blast radius for non-trivial changes.
- **SOLID is non-negotiable.** Single-responsibility components/modules;
  open-for-extension via composition, not by patching core paths; small
  focused props/contract interfaces; depend on abstractions.
- **KISS + DRY.** Reuse existing primitives (Button, Modal, NumberStepper,
  ConfirmDialog) — never reinvent per feature.
- **Clean, safe, readable.** Tight TypeScript types, validation at real
  boundaries (form submit, API call, IPC payload). No copy-paste hacks.
- **Production-ready only** — no `TODO: implement later` in shipped diffs.
- **Never expose secrets** or log tokens / PII.
- **Communicate with the user in Russian** (casual tone). Code, commit
  messages, and PR descriptions stay in English.

### Frontend conventions (this app)
- Functional components + hooks only. No class components.
- Component files small — ~200 lines is a yellow flag.
- Local state by default; lift up only when shared. Cross-cutting state →
  Context (already the pattern). **Do not introduce Redux/Zustand without a
  migration plan.**
- For server cache, prefer adding React Query rather than ad-hoc
  `useEffect` fetches (when scope grows).
- Reuse UI primitives; don't reinvent Button/Input/Modal per feature.
- **No hard-coded domain string literals — mirror the backend enums.**
  Any closed set the backend models as an `App\Enums\*` (device kind,
  status, session mode, role, skill) gets a matching TS `type` + a
  `const` map + helper predicates in one module; components compare
  against those, never bare `"ps"` / `"offline"`. **Canonical example:**
  `src/types/pc.ts` — `PcKind` / `PcStatus` + `PC_KIND` / `PC_STATUS`
  (`as const satisfies Record<…>`) + `pcHasAgent()` / `isPs()`. Adding a
  case is a one-file edit; a stray literal in a new diff is a bug.
  ⚠️ Do NOT conflate overlapping-but-distinct sets: `PcKind`
  (`"pc"|"ps"`, a *device*) is not `PlatformType` (`"pc"|"ps4"|"ps5"`, a
  *place's platform*).
- **Use in-app primitives for dialogs/toasts, never native.** Confirms
  via `useConfirm()`/`ConfirmDialog`, notifications via `notify.*` — a
  native `window.confirm()`/`alert()` poisons renderer focus (see traps).
- **When a backend API contract changes, update the consuming type +
  repository in the SAME change** — a Resource that drops/renames a field
  must be reflected in `IPcApi` et al. so `tsc` catches drift.

### Project-specific traps (memorise)
- **Typecheck command:** ALWAYS run both
  `tsc -p tsconfig.app.json --noEmit` **and** `tsc -p electron/tsconfig.json --noEmit`.
  The root `tsconfig.json` silently misses `src/` errors that CI catches.
  Use the `npm run typecheck` script which does both.
- **Number inputs:** never use raw `<input type="number">` — Electron
  swallows keystrokes. Use the `NumberStepper` primitive (text +
  `inputMode="decimal"`). Where the field must hold a STRING rather than a
  number — `SessionOptionsDialog`'s manual grant and unlimited rate, where
  empty means "not filled in yet" and the validation depends on telling that
  from zero — use the same mechanism directly (`type="text"` +
  `inputMode="decimal"`), never `type="number"`.
- **Confirm dialogs:** never use native `window.confirm()` — it poisons
  renderer focus on Linux WMs. Use the in-app `ConfirmDialog`.
  ⚠️ **Known debt — the rule is not yet true of the whole app.** Three native
  `confirm()` calls are still in HEAD. They predate PA-D and are out of its
  scope: `src/routes/BranchEdit.tsx:34` (delete branch),
  `src/routes/Notifications.tsx:119` (clear all), and
  `src/routes/BranchPricesPage.tsx:53` (delete tariff). Each should move to
  `useConfirm()` in its own change.
- **DevTools:** auto-detached DevTools also break renderer focus. Gate
  with `ELECTRON_DEVTOOLS=1` env var.
- **i18n:** language codes are `en` / `ru` / `am` (NOT `hy`). Use the
  `t()` helper from `LanguageContext` and `money()` for currency.
  Watch for duplicate translation keys.
- **No em dash in user-facing text.** A rendered string must never contain
  `—`: use a hyphen, a colon, or two sentences instead; in Armenian use `՝`
  or `։`, as the other repos now do. It covers `src/i18n/translations.ts`
  values, toast/notification/dialog copy and any literal rendered in JSX.
  Comments and docs (this file included) are out of scope.
  Check: `git grep -n "—" -- src`, then classify each hit as (a) user-facing
  (fix), (b) technical or log output (leave), (c) comment or doc (leave).
  A sweep on 2026-09-12 fixed 24 strings here (5 in the backend, 3 in the
  kiosk agent); what remains in `src` is comments and log/dev output only.
  ⚠️ The **en dash** `–` is deliberate in ranges and must stay: `0–100%`
  (`commission.hint`), `4–6` digits (`unlockPin.*`) and the `HH:MM–HH:MM`
  discount window on `BranchPricesPage`.
- **24-hour clock everywhere.** No AM/PM on any surface. Never call
  `toLocaleTimeString` without `hour12: false`.
- **Currency follows language.** Live FX rates (open.er-api.com) cached
  daily via `FxRatesContext` and mutate the shared rates singleton; all
  30+ price-bearing screens subscribe through this context.
- **`/branches`-style routes that mix public + protected:** use
  `Auth::guard('sanctum')->check()` on the backend, NOT `Auth::user()`.
  When the panel hits such an endpoint, expect 200 with reduced fields for
  unauthenticated callers — don't treat that as an error.

---

## 5. Booking domain (staff perspective)

### Verified statuses (from backend migrations)
`pending` · `confirmed` · `cancelled` · `rescheduled` · `finished`

> The earlier draft listed `expired` — that status does **not** exist in
> backend code. Reservation hold timeout is not yet implemented; when it
> ships, prefer a scheduled job over a new status.

### Status flow
```
pending ──confirm──▶ confirmed ──start──▶ (session) ──end──▶ finished
   │                     │
   ├──cancel──▶ cancelled │
   │                     ├──cancel──▶ cancelled
   └──reschedule──▶ rescheduled
                          └──reschedule──▶ rescheduled
```

### Hard rules for this panel
- **Do NOT expose "Rate branch" CTA.** That's mobile-only — fired by the
  backend Expo push `BookingFinishedRatePrompt` to guests, deep-links into
  `mob://bookings/{id}`. Staff have no rating UI.
- **Do NOT expose "Reschedule" on the booking-detail page.** Rescheduling is
  initiated from the mobile player app only (`PUT /guest-bookings/{id}` with
  `rescheduled_minutes`). Staff can only confirm / cancel / finish.
- **`finished` is terminal.** Once a booking flips to `finished`,
  `place_ids` are dropped and it must not be re-treated as active.
  `Booking.BLOCKING_STATUSES` excludes `finished`.
- **Confirm action regression watch (2026-05-24 report):** owner pressing
  "подтвердить код" in a push notification was flipping the booking to
  `cancelled`. Socket/handler flow is fragile here — extra care when
  touching notification action handlers.

---

## 6. Realtime / Sockets — Hard Rules (NEVER BREAK)

The Reverb + pusher-js + Echo stack must work **100% guaranteed**
end-to-end. Sockets are the difference between "the cashier sees the
booking instantly" and "the cashier finds out 30 s later via polling".

### Channel inventory (locked)

| Channel | Visibility | Purpose for this panel |
|---|---|---|
| `branch.{id}` | **private** (since 2026-08-18) | manager: booking + place + tournament + branch-subscribe events for one venue. The public `branch.{id}` still exists for the mobile app's guest token, carries no person, and this panel does not use it |
| `company.{id}` | **private** (since 2026-08-18) | owner: same scoped to a whole company |
| `bookings.global` | **private** (since 2026-08-18) | admin: same for admin-wide visibility |
| `branches` | public | catalogue feed: which venues an administrator just closed or reopened, as two lists of ids. Public because the mobile app listens on a guest token; carries no name, address or reason |
| `app-updates` | public | promoted-version broadcasts |
| `app-updates.{role}` | public | release-available per role |
| `user.{id}.notifications` | **private** (wire: `private-user.{id}.notifications`) | per-user notification feed |
| `user.{id}.access` | **private** (wire: `private-user.{id}.access`) | admin blocked this account's company / branch — sign out, or leave the branch |

Role-aware routing for staff is preserved in backend
`GlobalBookingNotifier::resolveBookingChannel`:
admin → `bookings.global`, owner → `company.{id}`,
manager → `branch.{id}`, orphan → null (no subscription).

### Event inventory (locked — name = `broadcastAs()`)

| Event | Name | Channels |
|---|---|---|
| `BookingChanged` | `booking.changed` | branch + company + global |
| `PlaceAvailabilityChanged` | `place.availability.changed` | branch |
| `BranchSubscribed` | `branch.subscribed` | branch + company + global |
| `TournamentJoined` | `tournament.joined` | branch + company + global |
| `SessionChanged` | `session.changed` | branch (**private**) |
| `UserNotificationCreated` | `notification.created` | user.{id}.notifications |
| `StaffAccessChanged` | `access.changed` | user.{id}.access |
| `BranchVisibilityChanged` | `branch.visibility.changed` | `branches` + branch.{id} |
| `AppReleaseAvailable` | `app-release.available` | app-updates.{role} |
| `AppUpdatePromoted` | `app-update.promoted` | app-updates |

### The socket's identity comes from the BACKEND, not from this build

`primeRealtimeConfig()` (called once from `App`) fetches `GET /realtime/config`
and adopts the host/port/scheme/key the backend actually broadcasts with,
caching it in `localStorage` for the next launch. `VITE_REVERB_*` is only the
fallback until that lands or when the backend is unreachable.

Every effect that subscribes takes `useRealtimeVersion()` as a dependency —
without it a subscription stays on the discarded client, looks alive and
receives nothing.

Proven with a build carrying `VITE_REVERB_KEY=PANEL_WRONG_KEY`: it adopted the
server's key, reached `connected`, and a block applied from another process
badged the branch list with no reload.

**2026-08-29 — then the server's key was the wrong one.** The staging backend
service still carried a key its Reverb service refuses, so every client that
asked was handed it, rejected with 4001, and polled for the session; realtime
was off across the panel and the phones without a single error anywhere but the
console. Adoption is therefore no longer unconditional: a 4001 on a
server-provided key drops that answer (the `localStorage` copy included),
rebuilds the client on the key this build ships, and remembers the refused key
so `primeRealtimeConfig` cannot pull the working connection back down. Pinned by
`src/realtime/echo.keyFallback.test.ts`.

A floor, not a cure — the deployment is still wrong until backend, Reverb and
the builds agree on one string. `php artisan realtime:check` on the backend is
what says whether they do; note that publishing succeeds even with a dead key
(Reverb authenticates that path by app id and signature), so only the client
handshake half of that command answers this question.

### Where the Reverb app key comes from (and what was wrong with it)

| Build | Source of `VITE_REVERB_KEY` |
|---|---|
| local dev (`npm run dev`) | `.env` — **untracked**, local to each machine |
| packaged staging build | `.env.staging`, which CI writes from the GitHub repo **variable `ENV_STAGING`** (`release-staging.yml`) |
| packaged production build | same shape, from the production variable |

(An earlier version of this file claimed `.env.staging` / `.env.production` are
tracked in git. They are not — `git ls-files` shows only `.env.example`. CI
materialises them from repo variables, which is where a key change has to be
made for packaged builds.)

**2026-08-28:** the local `.env` / `.env.staging` carried `uzhm…` while both
deployed Reverb services were running `iilyg…`, so every socket this panel
opened was refused with 4001 and it fell back to polling. The local files now
carry the key the servers actually run; if the packaged staging build shows the
same rejection, the `ENV_STAGING` repo variable still holds the old key.

### Realtime must re-read after a reconnect

A WebSocket has no backlog: anything broadcast while the connection was down is
gone. Two places re-read on reconnect (and only on RE-connect — the first
`connected` lands while the mount fetch is already in flight):
`BranchVisibilityGuard`'s screens through `accessVersion`, and
`NotificationsContext`, which re-reads its feed. Without it the 60 s poll
eventually corrects the unread COUNT while the feed itself keeps describing the
world as it was before the gap.

### Config: the app key must match the server

`VITE_REVERB_KEY` has to equal `REVERB_APP_KEY` on the Reverb service AND on the
backend broadcasting to it. Otherwise Reverb refuses the socket with Pusher code
**4001 "Application does not exist"**, every screen silently falls back to
polling, and the panel looks merely quiet. `src/realtime/echo.ts` prints ONE
loud `[reverb] REJECTED …` line naming the key and host; the backend has
`php artisan realtime:check`.

### Invariants — break these and clients misfire

1. **Every Event class implements `ShouldBroadcastNow`** (queue is `sync`).
2. **Broadcasts fire AFTER persistence** (post-commit, `wasChanged()` or
   after `->save()`).
3. **Every broadcast wrapped in `safeBroadcast()`** — a Reverb outage must
   NOT roll back the mutation.
4. **No double broadcasts for the same state change.**
5. **Event name = `broadcastAs()` output.** Desktop Echo prepends a dot
   (`.listen('.booking.changed', ...)`); mobile pusher-js uses the raw
   name. Renaming requires updating **both** clients in the same change.
6. **Channel name format is dot-separated** — never
   `branch_${id}` / `branch:${id}` / `branch/${id}`.
7. **`broadcastWith()` returns plain JSON arrays.** Nullable fields must be
   nullable in the TS interface — consumers `?.` them.
8. **Exactly ONE `new Echo()` call** in `src/realtime/echo.ts`, singleton
   on `globalThis` to survive HMR.
9. **`useEffect` cleanup uses `stopListening()`, not `leaveChannel()`** on
   shared channels (`branch.{id}` / `company.{id}` / `bookings.global`).
   Those channels carry MULTIPLE events; Echo caches the channel object
   without refcounting — `leaveChannel` from one hook kills every sibling
   subscriber. Pass the LISTENER to `stopListening` as well: called with an
   event name alone it removes every handler on that event, which is the same
   bug one level down.
   ⚠️ There is no such thing as a hook-owned channel here, and this rule used
   to name `useAppUpdates` on `app-updates` as one. It is not: four components
   mount that hook at once (`App.tsx`, `UpdatesNotificationContext`, and the
   two update routes), so leaving the channel from the route that unmounted
   deafened the root subscriptions for the rest of the process. A hook can be
   mounted more than once — assume it is.
10. **No HTTP refresh inside a Reverb event handler.** Optimistic-patch
    local state from the payload; periodic polling (30–60 s) handles
    canonical reconciliation.
    *One documented exception:* `AccessGuard` calls `refreshUser()` on
    `.access.changed`. The rule exists to stop a request storm on hot,
    high-frequency events; this one is an administrator pressing a button,
    fans out to the staff of a single company, and the payload deliberately
    does NOT carry the account's new scope (which branches it may still
    reach) — there is nothing to patch optimistically from. Do not read this
    as licence to fetch from booking/place handlers.
11. **Polling fallback is mandatory** on every realtime-critical screen
    (`useReservedPlaceIds`, `NotificationsContext` etc.) — 30–60 s. Reverb
    dropouts are silent; polling is the safety net.
    ⚠️ **Arm the interval ONCE, through a ref.** `useAsync` returns
    `{ ...state, reload }` — a new object every render — so an effect keyed on
    it clears and rebuilds the interval on every re-render and the period is
    never reached. `SessionsBoard`'s 30s poll was written that way and, at any
    venue with a PS5 bound (`useConsoleWatch` re-renders every 10s), **had
    never once fired**. Keep the callback in a ref and give the effect `[]`.
    Pinned by `SessionsBoard.polling.test.tsx`, which advances the clock in
    separate `act` blocks — inside one long advance React flushes effects only
    at the end and the bug is invisible.
12. **Reconnect means re-read.** A WebSocket has no backlog: everything
    broadcast during a drop is gone, and resuming the subscription does not
    bring it back. `useRealtimeResync(onReconnect)` is the one implementation —
    it ignores the FIRST `connected` (which races the screen's mount fetch) and
    fires on every one after it. Used by `SessionsBoard` and
    `NotificationsContext`; add it to any screen that patches from a payload.
    It calls `peekEcho()`, never `getEcho()` — a watcher must not be the thing
    that opens the socket.
13. **Guard against stale frames wherever state is patched from a payload.**
    Reverb does not promise order. `useReservedPlaceIds` keys the last applied
    `at` per BOOKING id (not per seat — two bookings can touch one seat), and
    drops anything older. An event with no readable `at` is applied: it cannot
    be ordered, and losing a change is worse than applying it out of turn.
    `.access.changed` gets a different safety net, not a poll: the backend has
    already revoked the account's tokens, so `src/api/client.ts` raises
    `sessionExpiry` on a 401 that carried a token and `AccessGuard` signs out.
    Polling for "am I still allowed in" would ask the same question the next
    request answers for free.
12. **Notifications must be branch-scoped.** Every push / email / Reverb
    delivery to staff is filtered by recipient `branch_id`. Owner/manager
    must not see other branches; no global broadcasts to staff. Audit
    backend `GlobalBookingNotifier` before changing scopes.

### Mandatory PR-time checklist (when touching realtime)

- [ ] Grep both clients (desktop + mobile) for the event name before
      changing `broadcastAs()`.
- [ ] Grep both clients for the channel name before changing
      `broadcastOn()`.
- [ ] Grep both clients for any payload key before removing it from
      `broadcastWith()`.
- [ ] If adding a new event, update this section's tables in the SAME
      change.
- [ ] Test multi-recipient delivery: open 2+ desktop instances
      (`--user-data-dir=/tmp/cp-panel-N`), trigger the event, verify both
      receive it.

---

## 7. UI / UX guidelines

- Modern gaming aesthetic — dark base (`#020514`), neon accents (cyan
  `#07DDF1` → blue `#32AFF7` → magenta `#D152FA`).
- Dark theme by default; no light theme implementation yet.
- Smooth CSS transitions; no jarring instant state changes.
- Responsive — must work down to ~1280×720 (cashier laptops).
- Playstation font for branding / headings; Inter for UI text.
- Stable button widths across i18n (don't let translations shift layout).
- Tariff / promo UI: server-computed `is_currently_active` is the source
  of truth; never compute the "discounted" badge client-side.

---

## 7.5 CSS / Styling Standards (NON-NEGOTIABLE)

### CSS Quality Rules

When writing or editing styles:

* CSS must be production-ready.
* Never write quick fixes.
* Never use random values without explanation.
* Every style must have a clear purpose.
* Prioritize maintainability over speed.

### Layout Rules

* Prefer Flexbox first.
* Use CSS Grid only when it genuinely simplifies layout.
* Never mix Grid and Flex unnecessarily.
* Avoid absolute positioning unless absolutely required.
* Avoid magic numbers.

Bad:

```css
left: 137px;
top: 43px;
```

Good:

```css
justify-content: center;
align-items: center;
```

### Spacing System

Use consistent spacing only.

Preferred scale:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Do not invent values like:

```css
margin: 13px;
padding: 27px;
```

unless there is a strong reason.

### Responsive Rules

Desktop panel must remain usable from:

```text
1280x720
1366x768
1440x900
1920x1080
2560x1440
```

Requirements:

* No horizontal scrolling.
* No overflowing cards.
* No text clipping.
* No broken flex layouts.
* No overlapping elements.

Always verify:

```css
min-width
max-width
overflow
flex-shrink
flex-wrap
```

before considering the task complete.

### Typography Rules

Use:

* Playstation Font → branding/headings
* Inter → interface text

Never mix fonts randomly.

Always use:

```css
line-height
font-weight
letter-spacing
```

intentionally.

### Animation Rules

Animations must feel premium.

Preferred:

```css
transition:
  background-color 0.2s ease,
  border-color 0.2s ease,
  transform 0.2s ease;
```

Avoid:

```css
transition: all;
```

Never animate:

```css
width
height
left
top
```

when transform can be used.

Prefer:

```css
transform
opacity
```

### Color Rules

Use theme tokens whenever possible.

Never hardcode colors if a theme value already exists.

Bad:

```css
color: #07DDF1;
```

Good:

```css
color: var(--color-accent);
```

### Component Styling Rules

Before creating new styles:

1. Search for existing component styles.
2. Reuse existing patterns.
3. Extend existing classes.
4. Create new styles only if reuse is impossible.

### CSS Architecture

Prefer:

```text
Component
 ├─ Layout
 ├─ State
 └─ Variants
```

Avoid deeply nested selectors.

Bad:

```css
.page .container .card .header .title
```

Good:

```css
.cardTitle
```

### Before Finishing Any Task

Claude MUST verify:

* No layout shifts.
* No overflow issues.
* No z-index conflicts.
* No broken responsiveness.
* No duplicated styles.
* No dead CSS.
* No unused selectors.
* No unnecessary !important.

### Forbidden

Never:

* Use !important unless absolutely unavoidable.
* Use inline styles for permanent UI.
* Use fixed heights for dynamic content.
* Use magic numbers.
* Duplicate CSS already existing in the project.
* Break responsive layouts to solve desktop issues.

### Final CSS Checklist

Before marking work complete:

* Responsive verified.
* Overflow verified.
* Alignment verified.
* Hover states verified.
* Focus states verified.
* Dark theme verified.
* Existing screens not affected.
* CSS remains clean and readable.

---

## 7.6 Client response cache (`src/api/httpCache.ts`)

`request()` in `src/api/client.ts` caches GET responses in memory. The
backend cooperates by putting a strong ETag on the same endpoints, so a
stale entry costs a 304 rather than a full payload.

Hard rules:

- **Opt-in only.** A path is cached only if `POLICIES` lists it. Live
  data — `/sessions`, `/pcs`, `/orders`, `/shifts`, `/notifications`,
  `/bookings`, `/members`, `/users` — must NEVER be added. The floor
  board and the cash drawer are allowed to be slow; they are not allowed
  to be wrong.
- **Memory only, bounded on both axes** (300 entries / 8 MB, LRU) plus a
  60s janitor that drops anything untouched for 10 minutes. Nothing is
  written to disk, so a panel left open for weeks cannot accumulate a
  cache directory. Do not "improve" this by persisting it.
- **Every identity change clears it** — `AuthContext` login AND logout.
  A manager signing in after an owner must not be able to read a
  response the owner's session cached.
- **Writes invalidate what they touch**, including the other resources
  that embed them (`MUTATION_FANOUT`). The Reverb handlers
  (`useBookingChanged`, `usePlaceAvailability`) invalidate too, so a
  change made on another machine lands immediately instead of waiting
  out a TTL.
  - `/admin/*` writes fan out to every venue-scoped cached prefix (`/branches`,
    `/places`, `/branch-platform-prices`, `/branch-subplatforms`,
    `/time-packages`, `/products`, `/games`, `/tournaments`): deleting an owner
    removes whole tenants and a block changes `is_blocked` on every branch
    payload. Admin writes are rare, so over-invalidating is the cheap side.
    Pinned in `httpCache.test.ts`.
- Pass `noCache: true` to `request()` for a forced refresh; it also
  sends `Cache-Control: no-cache`, which makes the backend recompute.

Chromium's own disk cache is capped at 50 MB by a command-line switch
and purged at boot plus hourly (`electron/main.ts`) — that is a separate
mechanism from this one, and both are needed.

Covered by `src/api/httpCache.test.ts` and `src/api/client.cache.test.ts`.

---

## 8. AI Assistant Behaviour (for me, Claude)

When working on this project:

1. **Verify before editing.** Read the file fully. Grep for symbols I'm
   about to change. State blast radius for non-trivial edits.
2. **Match this project's actual patterns.** Don't introduce Zustand into a
   Context-only app or Repository pattern into a Service-layer codebase
   without an explicit migration discussion.
3. **Honour SOLID and the rules above.** If a quick fix violates them,
   flag the trade-off openly.
4. **Cross-project changes** (booking status, API contract, broadcast
   channel) must be updated in every affected project in the SAME change.
5. **Never invent secrets, URLs, package versions.** If something isn't in
   the code, say so.
6. **Run typecheck before declaring done:**
   `tsc -p tsconfig.app.json --noEmit && tsc -p electron/tsconfig.json --noEmit`.
7. **No backend data in external-facing docs** (store listings, privacy
   policies, cert notes) — generic phrasing only, never Railway URLs or
   repo slugs.
8. **Be honest about un-verified state.** If something wasn't checked
   end-to-end (e.g., couldn't test WoL, no Windows machine on hand), say
   so explicitly rather than claiming success.
9. **"100% guaranteed" means proven, not asserted.** The user demands
   maximum rigor. Verify everything machine-verifiable (`typecheck`,
   `vitest run`, no stray literals via grep, HMR healthy) and give an
   **honest verified-vs-stage split** — never a bare "yes, 100%". The one
   thing a machine can't sign off is a **human click-through of the
   changed screens** — name exactly which screens to smoke-test rather
   than implying they were visually verified. Hold the line: don't
   fake-100% on anything you didn't actually run.

---

## 9. Specialist roles, agents & plugins (use them — don't improvise)

Cyber Place is built to a professional standard across four disciplines:
**architecture, security, design, go-to-market.** Each has a dedicated
subagent in `~/.claude/agents/` with this product's real constraints baked
in. Delegate instead of doing everything in one pass; run independent ones
in parallel.

| Agent | Use it for (panel-relevant) |
|---|---|
| `cp-frontend-architect` | State/data flow, hooks, API layer, Reverb wiring, per-user UI isolation, performance, strict-TS contracts |
| `cp-ui-designer` | Screens, board layout, status language, empty/error/offline states, `en/ru/am` sizing, §7.5 CSS compliance |
| `cp-security-engineer` | Electron hardening (`contextIsolation`, preload surface, CSP, navigation handlers, update signing), role-scoped data in the UI |
| `cp-backend-architect` | When the panel needs a field or scope the API doesn't provide — fix it server-side, don't fake it here |
| `cp-release-engineer` | electron-builder packaging, `artifactName`, signing, staging-as-separate-app, two-stage update gating |
| `cp-business-strategist` | Which tier gates which panel feature, and what metering that requires |

**Slash commands** (`~/.claude/commands/`): `/cp-design`, `/cp-feature`,
`/cp-secure`, `/cp-ship`, `/cp-market`, `/cp-business`.

**Plugins enabled in every session:**

- **`superpowers`** — brainstorming before building, TDD, systematic
  debugging, verification-before-completion. Process skills set the
  approach; implementation skills follow.
- **`frontend-design`** — invoke **before writing any UI**; `cp-ui-designer`
  applies it to this product's dark-first, dense operations aesthetic. Add
  `dataviz` for charts, KPI tiles, and dashboards.
- **`code-review`** — `/code-review` on the branch diff before pushing.
- **`aikido`** — `aikido:scan` on changed files after non-trivial work.
- **`context7`** — current Electron / React 19 / Vite docs instead of memory.

**Panel defaults these roles enforce** (restated because they regress most
often): the backend is the source of truth; realtime is Reverb delta **plus**
a REST snapshot on mount, and a slim broadcast means refetch; persisted UI
state is keyed per user (`u{id}:key`) and resets on auth change; role
scoping is enforced in the UI *and* the API, never only in the UI; no
native `confirm()` and no detached DevTools (focus traps) — use
`ConfirmDialog`; no `<input type="number">` — use `NumberStepper`;
typecheck **both** `tsconfig.app.json` and `tsconfig.node.json`; rebuild
and restart after changes — HMR misses CSP, `index.html`, and preload.

## 9.3 Support desk (`/support`)

A chat with Cyber Place support. The panel talks to OUR backend and never to
Telegram: support reads the other side on a phone, and that leg is a delivery
status on a message rather than a place data lives.

- **A thread is personal.** It belongs to the user who opened it — an owner
  does not see their managers' threads and vice versa. Enforced on the backend
  (ownership before branch scope, on every route); nothing is filtered here,
  because a filter in a component is a permission that stops applying the
  moment somebody calls the API directly.
- `useSupportMessages` subscribes to the PRIVATE `support.user.{id}` — the
  person, not the branch. One subscription covers every thread the account has,
  including one opened a second ago.
- Attachments have no URL. `supportRepository.downloadAttachment` fetches the
  bytes with the session token from `/support/attachments/{id}` and saves them
  through a blob; the payload carries no path, and there is nothing to link to
  that would skip the check.
- **Signing out drops the socket** (`disconnectEchoForSignOut` in `logout`).
  Channels live on the connection, not on the components that subscribed, so
  without it an account switch on one machine leaves the new operator attached
  to the previous one's private channels.
- `SupportUnreadContext` owns the sidebar badge, the chime and the floating
  card, and it is **entirely separate from the bell**. Support does not appear
  in `NotificationsContext`, in the Notifications screen or in its counter —
  not because anything filters it out, but because the backend stopped writing
  those rows. Its only input is `support.user.{id}`, through the same
  `useSupportMessages` hook the chat screen uses.
  - Not an arrival: a message this account SENT (the channel carries both
    directions), a message id already seen (a reconnect replays), and a reply
    to the thread on screen — for the badge only, which `SupportChat` reports
    via `setActiveConversation`; it still gets the card and the chime.
  - The count comes from the server (`unread` per conversation, summed) on
    mount and after every read. A channel has no history, so a restart shows
    the right number and plays nothing.
- `SupportNotifier` renders one card at a time, top-right beside the booking
  one: a burst of replies replaces it and restarts its timer instead of
  stacking. It plays `playSupportChime` — two soft sine notes stepping DOWN,
  against the app's rising triangle arpeggio. Never share the two: the sound is
  the only thing that says "a person is waiting for you" without looking.
- The branch question is asked with `BranchPicker` — selectable cards with the
  company, address and logo, searchable past six branches. One branch is not a
  choice: `SupportChat` opens that thread itself and never shows the picker.
- A send that fails stays in the thread, marked, with Retry — the text somebody
  typed about a problem they are having is the last thing to discard for them.

Nothing here knows the bot token, and nothing should: it is server-only.

## 9.4 The map's basemap (READ IF THE MAP GOES GREY)

Tiles come from `src/utils/mapTiles.ts`, never from a URL written into a
component. The reason is on the record: the panel drew CartoDB's public tiles —
free and keyless when that code was written — and CARTO later put them behind
registration. The URL still answered 200; every tile just became a grey square
reading "API KEY REQUIRED". Nothing threw, no request failed, and the map simply
stopped being a map.

Default: Esri Dark Gray Canvas, no key, two layers (the picture and the names
on it), `maxNativeZoom: 16` so the address picker can still zoom past 16 onto an
upscaled tile instead of blank ones.

To move to a paid provider, set `VITE_MAP_TILE_URL` (plus
`VITE_MAP_TILE_ATTRIBUTION`, and `…_MAX_ZOOM` / `…_MAX_NATIVE_ZOOM` /
`…_SUBDOMAINS` if they differ). The key lives in that URL template in the
environment — never in the source. It is public either way, since it ships in
the bundle and travels in every tile request; restrict it by referer at the
provider rather than pretending otherwise.

**The tile host must also be in `img-src` in `index.html`.** The CSP is not a
formality here: an allowed-by-default host does not exist, so a new provider
whose host is missing from that line renders nothing at all in Electron.

## 9.5 What each role may reach (2026-08-30)

`src/auth/permissions.ts` is the map every sidebar entry, hub tile, route guard
and CRUD button reads. It changed on 2026-08-30, and the backend gained its
mirror the same day —
`App\Services\Access\StaffCapability` — because a permission that only hides a
button is not a permission: a manager who kept the URL could still POST.

| Section | admin | owner | manager |
|---|---|---|---|
| Клиенты (members, deposits) | ✅ | ❌ | ❌ |
| Настройки филиала | ✅ | ✅ | ❌ |
| Смена (open/close/Z-report) | ✅ | ✅ | ❌ |
| Места | ✅ | ✅ | ❌ |
| Товары — создать / изменить / удалить / скрыть | ✅ | ✅ | ❌ |
| Товары — список + поиск | ✅ | ✅ | ✅ |
| Сессии, касса, игры, ПК, турниры, подписчики | ✅ | ✅ | ✅ |
| Джойстики, доп. время, безлимит на живой сессии | ✅ | ✅ | ✅ |
| Бесплатная сессия (списать счёт) | ✅ | ✅ | ✅ (since 2026-09-06) |
| Цены филиала — матрица, платформы, субплатформы, джойстики, округление | ✅ | ✅ | ❌ |
| Выручка и комиссия (`revenue.view`, §9.5.9) | ✅ | ✅ | ❌ |
| Статус филиала Active / Inactive (`branch.status`) | ✅ | ✅ | ❌ |
| Владельцы — список, изменить, удалить (`owner.view` / `owner.edit` / `owner.delete`) | ✅ | ❌ | ❌ |

Two things that look like oversights and are not:

- **Member cards are gone for the OWNER too.** They hold player identities and
  stored balances, and nothing on the cashier path reads them — the POS charges
  cash and sends `member_id: null`.
- **A manager without shifts can still take money.** `orders.cashier_shift_id`
  is nullable, so a sale files itself under the open shift if there is one and
  simply does not if there is not — exactly what already happened outside shift
  hours.

Product READS stay open to everyone: the POS sells from that list, and the
manager's screen is the list plus a search box with no write control on it.
So do PRICE reads, since 2026-09-03: the sessions board shows what a session
will cost and the "+ joystick" button has to know a price exists before it
offers to add one.

**The line inside sessions is not "manager vs owner", it is "spend the prices
you were given vs set them".** A manager adds a joystick, grants ten minutes
and lifts a time limit all day — that is running the floor, and every one of
those spends a rate the company already decided. Setting what anything costs is
the company's; the backend enforces it on `prices.manage`, and this map only
decides whether the control is drawn. Waiving a bill (`session.free`) sat on the
owner's side of that line until 2026-09-06 and is now the manager's too: the
person who waives a bill is whoever is at the counter when a machine crashes
(the backend moved `sessions.free` the same day).

## 9.5.4 Branch status: Active / Inactive (2026-09-11)

`branches.status` is `active | inactive` and means **whether players can see
the branch** — nothing else. It is the OWNER's switch (and the admin's). It is
not the block (`blocked_at` / `is_blocked`): the block is imposed on a company
by an admin and its owner cannot lift it. Players see only branches that are
`active` AND not blocked; an inactive branch stays fully workable for its
staff. (An earlier same-day version made `inactive` mean "awaiting admin
approval" with an admin-only `branch.approve`; that gate is gone on both
sides. If you meet "awaiting approval" wording anywhere, it predates this.)

- Vocabulary lives in `src/types/branch.ts` (`BranchStatus`, `BRANCH_STATUS`,
  `DEFAULT_BRANCH_STATUS`, `isBranchInactive`, `branchStatusOf`).
  `IBranchApi.status` is optional — an older backend omits it, and **absent
  reads as active**, never as inactive.
- The toggle is in THE `BranchForm`, drawn for `branch.status` (admin +
  owner, never manager), on **create and edit**:
  - create ALWAYS sends `status` (the form starts on Active, the backend
    default), so a branch starts exactly as the form showed it;
  - edit sends `status` ONLY when the user moved it — echoing the prefilled
    value would let a form opened before somebody else switched the branch
    quietly switch it back. The backend applies it for admin and the owner of
    the branch's company and drops it for anyone else.
  - **Position (2026-09-12): the status block is the LAST block of the
    form** — after the location block (map, Latitude / Longitude and the
    auto-locate hint), directly before Cancel / Save. The venue is described
    first; whether players can see it is the decision next to the button that
    commits it. Order only: create still ALWAYS sends `status` (starting on
    Active), edit still sends it ONLY when moved. Pinned by the "toggle's
    position" cases in `BranchForm.status.test.tsx` (DOM order, create and
    edit).
- Indicator: `BranchStatusPill status={…}`, unchanged. In every branch LIST
  (`BranchesList`, `CompanyBranches`, the admin's owner page) the row is
  `BranchListRow` (`src/components/branches/BranchListRow.tsx`), one component
  for all three: logo, then a text block (name, meta under it), then the pills
  as their OWN flex item, then "Open". Status is always the last pill,
  "Blocked" (when it applies) right before it. The pill used to be inline text
  inside the name or the meta line and read "Abovyan 5Active"; it may never go
  back inside `.name`. CSS `.branch-row__*` (global.css, after
  `.list-item .meta`): only the text block shrinks (`flex: 1 1 auto;
  min-width: 0`) and wraps (`overflow-wrap: anywhere`); pills and "Open" are
  `flex: 0 0 auto` + `nowrap`, so a long address can neither push nor clip
  them, and the status pills line up in one column down the list. The old
  `.owner-branch*` rules are gone. Inactive = `pill pending` (amber), tooltip
  `branch.inactive.hint`; Active = `pill confirmed` (green), tooltip
  `branch.active.hint`. Absent `status` (older backend) renders Active via
  `branchStatusOf`. One component, one lookup table (`LOOK`, `satisfies
  Record<BranchStatus, …>`); callers no longer gate it with
  `isBranchInactive`. The `BranchHub` header and the `BranchEdit` status row
  still use the bare pill. The hub still adds the `state-notice` for an
  inactive branch ONLY: the same sentence for owner and admin plus where the
  switch is (Settings → Edit info → Active); a manager, who cannot switch it,
  gets the sentence alone. An inactive branch is NOT read-only.
- Refresh after saving is the existing path: the update is
  `POST /branches/{id}?_method=PUT`, whose write fans out to every `/branches`
  entry in `httpCache`, and `BranchEdit` re-reads via `reload()`. Pinned in
  `client.cache.test.ts`.

Tests: `BranchForm.status.test.tsx`, `BranchStatus.indicator.test.tsx`,
`types/branch.test.ts`, `permissions.test.ts` — mutation-verified (edit
always-sends, create never-sends, owner without `branch.status`, manager
getting the hub pointer: each fails the suite). `BranchStatus.indicator.test.tsx`
now pins one pill per branch with the right state on the hub, both lists and the
settings page (active, inactive, absent → active). Mutation-verified (active
pill returns null; absent read as inactive; hub header back to inactive-only).
Since 2026-09-12 it also carries "row layout" for both lists (the name holds
the title only, the pills are the text block's next sibling, order
Blocked-then-status, "Open" after, plus the CSS rules), and
`OwnerDetails.test.tsx` carries the same check for the owner page.
Mutation-verified: pill back inside the name; status before Blocked;
`min-width: 0` removed.

## 9.5.5 How far ahead a reservation holds a seat (2026-09-11)

`Booking.isReservingAt(t)` used to ask only whether the booking's END was still
in the future. That is true of a reservation next Saturday — so ONE booking made
a week out painted the seat orange today and `canStartSession` refused every
walk-in on it until the booking played out. **Six days of a seat the venue could
not sell.**

It now also requires the start to be within `RESERVATION_LEAD_MS` (**2 hours**,
in `src/domain/Booking.ts`). The number is a judgement, bounded on both sides:
`Place.test.ts` pins "an upcoming booking reserves the seat" with an hour to go,
so it cannot be shorter; and an evening reservation must not cost the afternoon,
so it cannot be much longer. Change it there and every screen that asks "is this
seat spoken for" changes with it — `useReservedPlaceIds`, `Place.computeStatus`,
`PlaceAssignmentPolicy`, `RealtimeService`.

`isUpcomingAt(t)` is the other half: free NOW, taken later. Deliberately a
separate question — collapsing the two is what produced the week-long block.

Pinned from both directions in `Booking.test.ts`; mutation-verified against an
unbounded rule, a week-long horizon and a five-minute one.

## 9.5.6 "Finish on another seat" (2026-09-11)

When a grant is refused because the seat is reserved ahead, the dialog does two
things beside showing the sentence: it offers the grant the seat CAN still take
(`max_minutes`), and it asks `GET /sessions/{id}/extension-options` for seats
that could take the full one. Pressing one calls
`POST /sessions/{id}/transfer-extension`.

⚠️ **That list is stale the moment it is drawn.** A phone can reserve one of
those seats while the modal is open, and the server answers 409. That is a
correct outcome, not a bug — never disable the button on the strength of the
list, and never treat the preview as a promise.

The lookup only runs for a seat refusal (`seatUnavailableBodyOf` returned a
body). Any other failure — session not active, network — must not bury the
sentence the cashier has to read under a suggestion feature.

The session that comes back is the SAME session: same id, same start, same
bill, same products and pads. The board patches it in place like any other
session update.

## 9.5.7 The owner's sidebar (2026-09-11)

- **"My company" links to `/companies/{dashboard.company_id}`**, the way
  "My branch" links to `/branches/{dashboard.branch_id}`. It used to link to
  `/my-company`, a route whose only job is `<Navigate replace>` — a link to a
  redirect is never the current page, so the item never lit up anywhere. Prefix
  matching now covers `/companies/{id}/branches` and `/companies/{id}/revenue`.
  `/my-company` stays for old hash bookmarks and is still the target for an
  owner with no company (it explains that).
- **There is no create action in the sidebar** (removed 2026-09-12). The nav
  column holds links only. Creating a branch is the primary button in the header
  of the Branches page (`BranchesList`, §9.5.7a). The `.sidebar-action` /
  `.sidebar-action--nested` styles and the sidebar's lazy `BranchForm` import
  went with it.

Tests: `Sidebar.ownerNav.test.tsx` — "My company" active on all three company
routes (and the route-table asserts over `App.tsx`, including that
`/owners/:ownerId` is guarded by `owner.view`), not active elsewhere,
`/my-company` fallback, Owners for admin only and lit on `/owners/7`; and the
navigation holds no button for owner / admin / manager, Branches is followed by
a link, `Sidebar.tsx` does not mention `BranchForm`, `global.css` has no
`sidebar-action`. Mutation-verified (link back to `/my-company`, `end` on the
link, create button put back under Branches).

## 9.5.7a "+ New branch" on the Branches page (2026-09-12)

- `BranchesList` (`/branches`) draws "+ New branch" (`branchesList.newBranch`,
  en "+ New branch" / ru "+ Создать филиал" / am "+ Ստեղծել մասնաճյուղ") as the
  header action: a `row-between` row above the list with the `Button` on the
  right, the same shape as Managers. Visible exactly when the sidebar entry was:
  `branch.create` AND a numeric `dashboard.company_id`. That means the owner; an
  admin has the permission but no company of their own and creates from a
  company page, and a manager lacks the permission.
- It opens THE `BranchForm` with `companyId = dashboard.company_id`, create mode.
- After saving: close the form and `reload()` the page on screen, the same
  handling as `CompanyBranches` / `CompanyDetails`. No navigation. The POST
  already dropped every cached `/branches` listing, and the repository's
  "created" toast confirms the save even when the new branch lands on a later
  page (the backend lists in id order, 12 per page).
- `CompanyBranches` keeps its own "+ New branch" button (same form). Its label
  key is `companyBranches.newBranch` ("+ Новый филиал" in ru), and the company
  page's is `company.addBranch`: three wordings for one action, left as they
  were.

Tests: `src/routes/BranchesList.create.test.tsx` (7): header button above the
list and last in its row, opens the mocked `BranchForm` module with company 5
and no `initial`, save closes + re-reads page 1 and stays on `/branches`, cancel
asks nothing, hidden for an owner without company, for admin, for manager.
Mutation-verified (no company check; save without re-read).

## 9.5.8 Owners (admin, 2026-09-11)

`/owners` (RoleGuard `owner.view`; sidebar item after Managers), backed by
`GET|PUT|DELETE /admin/owners[/{id}]` (`Admin\OwnerController`, `admin`
middleware; `{owner}` resolves only a `company_owner`, anything else is 404).

- Transport `src/api/owners.ts` — types mirror `OwnerResource`,
  `DeletionPreviewResource`, `OwnerDeletionResource` and the 409
  `TenantDeletionBlockedException` body field for field. Repository
  `src/repositories/OwnerRepository.ts`. Deliberately NO `orFallback` (a failed
  list must not read as "no owners") and NO `friendlyMutation` (a 404 here
  means the owner is already gone, not "endpoint not deployed").
- List: server search (name / email / company name) through
  `useDebouncedValue` (400 ms) + `Pagination` (20 per page). The page belongs
  to the query it was chosen for, so a new search requests page 1 once — no
  reset effect, no wasted request. A page that vanishes after a delete steps
  back to the last existing page. Rows are memoised.
- Each row: the owner's NAME links to `/owners/{id}` (the owner page, below);
  email; and per company (`OwnerCompanyLine`, shared with the owner page) a
  link to the EXISTING company page, branches / managers counts, the company
  status pill and the blocked pill.
- **Owner page** `/owners/:ownerId` (`src/routes/OwnerDetails.tsx`, RoleGuard
  `owner.view`; the Owners sidebar item stays lit by prefix match). One read,
  `ownerRepository.byId` → `GET /admin/owners/{id}` — the same read the delete
  dialog uses; `/admin/*` GETs are not in the `httpCache` policies, so both are
  fresh. Shows name, email, registered date (`formatDate`), then a card per
  company: its `OwnerCompanyLine`, and under it `companies[].branches` as
  `BranchListRow` rows (address, city, then the pills as their own element,
  "Blocked" when `is_blocked` and the `BranchStatusPill` last — §9.5.4) linking
  to `/branches/{id}`. `branches` is typed optional
  (`IOwnerDetailCompanyApi.branches?`): **absent = older backend → counts only,
  never "No branches yet."**; `[]` = the company really has none. A
  non-integer id renders "Invalid owner id" and asks nothing. Edit = THE
  `OwnerForm` → re-read; Delete = THE `OwnerDeleteDialog` → `navigate("/owners",
  {replace: true})` (there is nothing left to show).
- Edit: `OwnerForm` modal, name + email only (no password — the reset flow
  stays), `PUT`; a taken email is the server's 422, shown per field.
- Delete: `OwnerDeleteDialog` on the in-app `ConfirmDialog` (never native
  `confirm()`). It asks `GET /admin/owners/{id}` FIRST and shows the preview
  counts (companies, branches, manager accounts, places, sessions in history,
  member cards with a balance). Confirm is refused while the preview is loading
  or failed, when `can_delete` is false, and after a 409 — whose blockers
  (computed under the delete's own locks) replace the preview's. Blockers are
  worded by the panel from their code (`running_sessions`,
  `upcoming_bookings`); an unknown code falls back to the server's `message`.
  After a delete the list re-reads.
- `ConfirmDialog` gained `confirmDisabled` (additive; `ConfirmProvider`
  unchanged).
- `.btn.secondary.is-danger` (global.css, Owners block) is the destructive
  secondary button — token-derived colours. Older screens still carry the
  inline `color/borderColor` pair; migrate them when touched.
- The people whose company was deleted get `StaffAccessChanged {action: block,
  locked_out: true, code: "account_deleted", message: "Your account has been
  deleted."}`. `AccessGuard` signs them out and shows the panel's OWN sentence
  for that code (`blocking.reason.account_deleted`, en/ru/am), not the
  server's, which is in the language the ADMIN's delete request negotiated.
  The code is mapped by `lockoutKeyFor` (`src/api/blockingErrors.ts`): every
  block code plus the lock-out-only reasons (`LOCKOUT_ONLY`). It is
  deliberately NOT in the block set (`KNOWN`), because `blockedBodyOf` answers
  the login screen's "was this a block?" and a deletion is a different fact.
  An unknown code (or a null/absent one, which is what a backend older than
  this sends) still shows the server's `message`, falling back to
  `blocking.evicted.lockedOut` when there is none. That is the committed
  behaviour of every panel in the field, and it is pinned.
  Tests: `AccessGuard.test.tsx` (account_deleted in en/ru/am with the real
  translations; unknown code with and without a message; code null/absent) and
  `blockingErrors.test.ts` (`lockoutKeyFor`; account_deleted is not a block;
  the key exists in all three languages). Mutation-verified: AccessGuard back
  on `blockingKeyFor`; `LOCKOUT_ONLY` dropped; account_deleted added to
  `KNOWN`; every string code given a key; server message ignored for an
  unknown code.

**Contract:** `GET /admin/owners/{id}` → `data.companies[].branches[]`:
`{id, address: ?string, city: ?string, status: "active"|"inactive"|null,
is_blocked}` (nullability as `OwnerResource::branch()` declares it) — single
read only, not on the list. Mirrored in `src/api/owners.ts`
(`IOwnerBranchApi`, `IOwnerDetailCompanyApi`, `IOwnerDetailApi.companies`).
The page renders a null address as `№{id}`, a null city as "-", a null status
as Active (`BranchStatusPill` accepts `BranchStatus | null | undefined`).
Pinned by the "null fields" case in `OwnerDetails.test.tsx` (mutation-verified:
unguarded `LOOK[status]` crashes the page; raw null address).

Tests: `Owners.test.tsx` (transport-level: URL, verb, body; also pins the name
link), mutation-verified (confirm allowed despite blockers, 409 not parsed, no
reload after delete, PUT→PATCH, confirm without a preview, search keeping the
old page, list name not a link). `OwnerDetails.test.tsx` (14, transport-level
like `Owners.test.tsx`): identity + date, companies with link/counts/status/
blocked, branches with address/city/status/link inside their company card, empty
list, missing `branches` key (counts only), no company, failed read, invalid id
(zero requests), back link, edit → PUT + re-read, delete → DELETE + `/owners`,
cancel, no buttons without permissions, null fields. Mutation-verified (branches ignored;
missing key treated as `[]`; delete re-reads instead of leaving; edit without
re-read).

## 9.5.9 Revenue screen — tournaments, owner income, per branch (2026-09-11)

`/revenue` and `/companies/:id/revenue` both render
`src/components/revenue/CompanyRevenueScreen.tsx` (behind `revenue.view`: admin
and company_owner, never manager). One call: `GET /company/{id}/revenue-summary`
with the LOCAL calendar month's bounds as `from`/`to`.

**Every amount comes from the server and is printed as-is. The screen formats
figures and never computes them.** No subtraction, no multiplication, no totals
row. Owner income is the server's `owner_income`, never "total − commission",
because a second copy of that formula would drift from the server the first time
its rounding changes. The component test pins this with deliberately
inconsistent fixture figures.

### Which key is printed where

| Row | Key (current backend) | Older backend (no tournament keys) |
|---|---|---|
| Closed sessions / Sessions | `sessions_count` / `sessions_total` | same |
| POS orders (only if > 0) | `pos_total` | same |
| Paid tournament entries / Tournament entry fees | `tournaments_count` / `tournaments_total` (shown even at 0) | row hidden |
| Total revenue | `total_gross` | falls back to `gross_total` |
| Cyber Place commission | `commission_percent` + `%` | same |
| **You owe us this period** (highlight) | `total_commission_amount` | falls back to `commission_amount` |
| Owner income | `owner_income` | row hidden, never derived |

Company-level `commission_amount` keeps its old meaning: commission on sessions
plus POS only. Do not print it as "owed" when `total_commission_amount` is
present.

### Amounts to the hundredth (2026-09-11)
The server's figures are exact to the cent, and the card is read as a
statement: total, what is owed, and owner income. Rounded to whole units,
9000.50 / 900.05 / 8100.45 printed as "9,001 − 900 = 8,100", which does not add
up. On THIS screen only (`RevenueSummaryCard`, for the company card and for a
branch's), every amount goes through `money(value, centsWhenFractional(value))`:

- the server value has non-zero cents: exactly two decimals ("9,000.50", never
  "9,000.5");
- a whole value: no decimals, byte-identical to plain `money()`;
- decided per amount, from the server's own value. The screen still does no
  arithmetic. Sub-cent float noise (9000.004) counts as whole.

`centsWhenFractional` lives in `src/i18n/currency.ts` next to
`preciseWhenSmall`. `MoneyFormatOptions` gained `minimumFractionDigits`
(additive). The formatter widens the maximum to at least the minimum, because
Intl throws a RangeError for min 2 with the AMD default max 0. The global
`money()` default (whole units) is unchanged. `currency.precision.test.ts`
pins "asking for nothing changes nothing".

### Branch selector (replaced the per-branch table, 2026-09-12)
`BranchRevenueTable` is gone; no per-branch TABLE is rendered any more. The
toolbar under the title holds the month picker and, when the response lists
MORE THAN ONE branch, a branch selector: the repo's picker idiom (a `.label` +
native `select.input`, as on the Revenue screen's company picker; there is no
Select component in `src/components/ui`). Options: "All branches"
(`revenue.allBranches`, the default) then every row of `branches[]` in the
server's order, labelled by address or `№{branch_id}` (`branchLabel`). The
closed control is `flex: 0 1 360px` and ellipsizes a long label, with the full
label in its `title` and each option's.

- **Hidden when `branches` is absent (older backend), empty, or has ONE row**
  (`selectableBranches`): one branch is the company, and offering it beside
  "All branches" would show the same figures twice.
- **All branches** = the company card exactly as before (same keys, same
  older-backend fallbacks, title `revenue.summaryTitle`).
- **A branch** = the SAME card (`RevenueSummaryCard`) with that branch's row,
  titled `revenue.branchSummaryTitle` ("Revenue for the month: {0}") so a
  branch's figures are never read as the company's. Rows: `sessions_count`,
  `sessions_total`, `pos_total` (only if > 0), `tournaments_count` /
  `tournaments_total` (always, zeros included), `total_gross`, the COMPANY's
  `commission_percent` (a branch has no rate of its own; its
  `commission_amount` is charged at the company rate on its `total_gross`),
  the branch's `commission_amount` as the highlighted owed row, `owner_income`.
  A branch with nothing that month prints zeros, the existing convention. The
  cents rule applies per figure as before.
- Picking is a filter over the response on screen: no request.
- **Across months:** the choice is kept if the new answer still lists that
  branch as a choice; otherwise the screen falls back to All AND forgets the id
  (a branch that reappears a month later is not re-selected on its own). A
  month with one branch hides the selector and shows the company. While a month
  loads: the skeleton, no card, and the select is disabled, so a choice only
  ever applies to figures on screen. A failed load keeps the choice for Retry.
- Key picking lives in `src/components/revenue/revenueFigures.ts`
  (`companyFigures`, `branchFigures`, `branchLabel`, `selectableBranches`),
  pure and arithmetic-free; `RevenueSummaryCard` takes `figures` + `title`.
- i18n: added `revenue.branch`, `revenue.allBranches`,
  `revenue.branchSummaryTitle`; removed the table's `revenue.byBranch`,
  `revenue.colBranch`, `revenue.colTournaments`, `revenue.closedCount`,
  `revenue.entriesCount` (the Armenian "Մասնակից՝ n" note no longer applies).

### Loading behaviour
- Only the latest request lands (`requestSeq` ref). Flipping months quickly can
  never paint an earlier month's figures under the current label.
- A failed load clears the figures and shows the error with a **Retry** button.
  The previous month is never left on screen under the new month's label.
- The `percent`/`initialPercent` state is NOT dead code. It is never shown or
  used in a sum, but it acts as a reload trigger. `useAsync` background
  refreshes can deliver a changed `commission_percent` for the same company
  while the screen stays mounted, and the summary is then asked for again.
  Keep it, or replace it with an equivalent trigger.

### Styles
`global.css` → "Revenue (CompanyRevenueScreen)" block: `.revenue-card`,
`.revenue-card-title` (now `overflow-wrap: anywhere` for a long branch title),
`.revenue-toolbar` (flex, wrap, bottoms aligned, gap 16/24),
`.revenue-branch-field`, `.revenue-branch-select` (min-height 40, ellipsis).
All `.revenue-table*` rules are removed. The month picker buttons are 40px
(desktop target minimum) and the month label uses tabular digits, so the next
button stays under the cursor.

### Tests
`src/components/revenue/CompanyRevenueScreen.test.tsx`: `money` is mocked to
print the number exactly as received, so a re-derived figure shows up in the
output — summary (4), selector (7: hidden for one branch / empty list / older
backend; default All with options; a branch's row verbatim with no extra
request and owner income deliberately NOT total minus commission; empty branch
zeros; back to All), across months (3: kept with the new month's figures and
nothing painted or selectable while loading; gone, back to All and stays there;
one-branch month), loading (2). `RevenueAmounts.test.tsx`: the REAL formatter
with the live E2E figures, on the company card and on a branch card.
`revenueFigures.test.ts`: the key mapping, labels, `selectableBranches`.
`currency.precision.test.ts` covers the helper. Mutation-verified: helper
without a minimum; helper that gives whole amounts cents; card back on plain
`money()`; formatter without the max≥min clamp; `Number.isInteger` instead of
the cent test; branch owner income derived; branch owed computed from the rate;
selector for a single branch; stale selection kept; select not locked while
loading; card painted while loading; first branch selected by default.

## 9.5.10 Tournament registrations — removing one (2026-09-11)

`RegistrationsList` (tournament page) removes a registration with
`DELETE /tournament-registration/{id}`. Since 2026-09-11 the backend REFUNDS a
verified player's entry fee when the tournament has not ended
(`TournamentRefundService`): the payment is stamped `refunded_at` and drops out
of revenue and commission.

- The confirmation is the in-app `useConfirm()` (destructive), never a native
  `confirm()`, which it used until this change.
- A VERIFIED player's question carries `registrations.removeRefundNote` under
  `registrations.confirmRemove`: "This player is verified. If the tournament
  has not ended yet, their entry fee is refunded and no longer counts in
  revenue." A spectator or an unverified player never paid (the backend creates
  a payment only on verification), so they get the plain question. The note
  states the server's rule. It does not predict the outcome, because "has the
  tournament ended" is the server's call.
- Confirm → one DELETE for that registration id, then the list is re-read.
  Cancel → no request. A refused delete shows the server's reason and keeps
  the row.

Tests: `RegistrationsList.test.tsx` (10, transport-level: only `request()` is
replaced). Mutation-verified: native `confirm()` restored; answer ignored; note
shown for everyone; note never shown; delete by guest id.

## 9.6 A live session's terms (2026-09-03)

Four controls a cashier gets on a session that is already running, and one rule
that governs every one of them.

**A refusal names the alternative (2026-09-11).** When a grant or the unlimited
switch is refused because the seat is reserved ahead, the 422 carries
`code`, `latest_allowed_end` and `max_minutes` beside the sentence.
`api/seatUnavailable.ts` reads it and the dialog offers exactly that grant as a
button — the cashier used to find the ceiling by halving the number until one
went through. ⚠️ It is ADVICE: a phone can take the seat between the refusal and
the press, so the button sends a normal request and being refused again is
correct. Zero headroom is never offered.

**The backend is the source of truth, literally.** Each action returns the WHOLE
session and the caller replaces its row with it — `SessionOptionsDialog` and
`SessionsBoard` both do. Nothing on this side computes a joystick count, an end
time or a total. A card that did would be right until a second cashier touched
the same seat, and then quietly wrong on one of the two screens with nothing
saying so.

| Control | Where | Who |
|---|---|---|
| 🎮 set the pad count (select, 1–4) | the seat's tile in `SessionsBoard` | everyone who works the branch |
| +10 / +30 / +60 minutes | `SessionOptionsDialog` | same |
| switch to unlimited | same | same |
| Free (start it waived) | `StartSessionDialog`, behind `session.free` | same (managers since 2026-09-06) |
| joystick prices, rounding policy | `BranchPricesPage` | admin + owner |

⚠️ Two rows MOVED out of `SessionOptionsDialog` (2026-09-10). Pads are set on
the tile, because a cashier looking at the board can already see how many are in
play and opening Add Time to change them was a detour. Waiving the bill is now a
decision made when the session STARTS and nowhere else — it is what the whole
session costs, not an adjustment to make halfway through, and mixing it into the
add-time dialog put an admin-only control in a dialog everyone uses.

**Free is offered at the START as well as on a running session (2026-09-04),**
and it is the same capability in both places — the server asserts
`sessions.free` on `POST /sessions` too, so a caller without it who sends the
flag gets a 403 and no session. The checkbox sits below the tariff and outside
the fixed/open branch, because it applies to either and it is a decision about
the BILL rather than about the tariff. It is deliberately not wired to the
"change current price" override beside it: free is not a price of zero, and the
two diverge the moment a drink goes on the bill.

**The tile's figure is the clock PLUS what is on the seat (2026-09-06).**
`sessionAmount.ts` composes it the way `SessionPricingCalculator` does —
`sessionTimeCostAt` mirrors `Session::timeCostStringAt` and stays clock-only so
each half can be checked against its own counterpart, and `sessionAmountAt`
adds `sessionItemsTotal` on top, with the waiver applied to the composed figure
(a free seat gives the drinks away with the hour, exactly as the server does).
Items are READ from `items[]`, never accumulated, so a Reverb refresh cannot
charge the same drink twice.

Two terms of the server's subtotal are still missing and both make the tile
read LOW rather than high: extra joysticks — a decision, since the periods do
travel on the payload and mirroring a second ticking charge is a bigger change
than the one that was needed — and the branch rounding step, which does not
travel at all. A seat with pads, or a branch with a rounding step, will differ
from its receipt. The receipt is right; it comes from the server.

**A fixed tariff is an HOURLY RATE with an auto-stop (settled 2026-09-06).**
`time_packages` states the rate by stating a price for a duration — 1500 for 60
minutes is 1500/hour, 1000 for 30 minutes is 2000/hour — and a player who
leaves at 00:30 owes 750. The tile ticks all the way there.

This REVERSED on 2026-09-06, twice in one day: it was a block owed in full
from its first second, was re-confirmed as such that morning, and was then
changed. If you are reading a comment or a commit that says a package is owed
in full, it predates this. `committed_amount` is no longer a price — it is
what has been committed to, and only the unlimited branch and the
deleted-package fallback still bill from it.

**The rate lives in two places and they must move together.**
`Session::tariffHourlyRate()` and the `tariffHourlyRate` in `sessionAmount.ts`
are the same two-step ladder: `hourly_rate` when set, else the package's
`price × 60 / duration_minutes`, else null — and null bills the committed
figure rather than nothing. `time_package` is on `ISessionApi` for this, and
the sessions listing eager-loads it.

**Unlimited went pro-rata with it, later the same day.** Removing a session's
end is a decision about the AUTO-STOP and not about the bill: a session
switched at 00:15 and stopped at 00:30 owes the same 750 as one nobody
touched. `unlimited_at` and `committed_until` take no part in the price on
either side any more — if you see a branch reading them to compute money, it
is older than this.

**The tile names the pads that are OUT, not a fraction of a ceiling.**
`padIdentity()` prints the seat's count while nothing extra is out, and the
slots themselves once something is — `"3"`, `"3, 4"`, or `"3/4"` where the venue
prices the pair as one figure and naming the position it happened to open would
tell a cashier something the venue deliberately did not distinguish. It began as
`🎮 3 / 4` against a constant ceiling of four; the ceiling is the venue's now
(`padCeiling()` → `joystick_rule.max_slot`), and a fraction against a number that
changes per room reads as a different question than the one it answers.

**Next to it is a `select` of PADS — which one, not how many — and the whole row
must stay on ONE line.** Each option carries the slot and what it costs
(`Joystick #3 · 500`, `Joystick 3/4` where the venue shares one figure, and a
tail of `free` / `already charged` / `no price set` / `already in use`), so
the figure the cashier sees is the figure the server will freeze onto the row.
Handing one BACK is a separate `−` button, drawn only above the base kit: the
select used to be a target COUNT and the server picked the slot, and a single
control that both charges and refunds by direction is how a mis-click becomes
money. A once-per-seat venue gets neither — `padSwitch` draws one button, out or
back. The row is `flex-wrap: nowrap` with the count `flex-shrink: 0` and the
select fixed in width, because the tile is 160px and a full-width input pushed
the count onto a second line, where it read as another field rather than as the
label of the control beside it.

**No native `confirm()` in the session dialogs** (the app as a whole still has
three — §4 traps, "Confirm dialogs"). The unlimited confirmation used
`window.confirm`, which poisons the Electron renderer's keyboard focus on Linux
— the NEXT modal's inputs stop accepting keystrokes, so the action that appears
broken is not the one that broke it. It goes through `useConfirm()` now, and
`SessionOptionsDialog.test.tsx` asserts the native call is never made.

**How many pads the rate covers is the venue's setting, not a constant.**
`branches.joystick_included` (1..4, default 1) sits beside the fee on Branch →
Prices and travels in the billing-settings payload as `joystick_included`, with
`joystick_max` alongside it. Both forms on that screen PUT the WHOLE policy, so
both send both joystick figures — `MoneyRoundingForm` passing the joystick half
through untouched is the reason the fee survives a rounding change, and the
allowance now rides with it. `includedJoysticks()` in `api/joystickPrices.ts` is
the single place that fills in 1 for a backend that predates the field.

Nothing on the board changed and nothing needed to: a pad inside the allowance
comes back from the server priced 0.00, so `sessionAmount`, the tile's pad line,
the receipt and the history all reach the right figure with the arithmetic they
already had. A free pad is still a row, still counted in `joystick_count` and
still a line in the log.

**Joysticks are PlayStation-only, and the question is the PLACE's platform.**
`pc.kind === "ps"` means "no kiosk agent" and is equally true of a ping-pong
table — `platformGroup(place.platform) === "ps"` is what the dialog asks, the
same question the backend asks.

**The fee's three states are three named choices, not one box.** The wire is
one nullable number: a figure is the fee, `0` hands extra pads out for nothing
and `null` means this venue does not offer them. Two of those used to be typed
into the same field and one of them was typing nothing, so the branch's form
asks the question instead. That form is `BranchJoystickForm` since 2026-09-17
(`JoystickPricesForm` before it, and the file is gone): it now asks the venue's
TWO questions — which pads cost money, and how much — and deliberately nothing
else. The strategy, the charge mode and the fourth pad's separate figure are the
ROOM's questions, asked on the place form, because asking them twice in two
places is how two screens end up disagreeing about one venue. `""` is "this
venue has not answered", which every branch is until somebody chooses; without
it the page would light Save the moment it rendered and an owner who came to
read the screen could save a choice they never made.

**A place may override the branch, and empty means inherit.** `places`
carries `joystick_included`, `joystick_price`, `joystick_charged_slots`,
`joystick_pricing_mode` and `joystick_charge_mode`, all nullable, and null is
INHERIT rather than the branch's "not offered" — the same empty-means-inherit
shape `hourly_rate` has in the same form. `PlaceForm` draws them for PlayStation
places only, sends `null` for anything else (so a seat that stops being a
PlayStation drops the override it had), and a typed `0` is a real per-place
setting: this seat gives extra pads away.

### The room answers the joystick questions now (2026-09-15 → 09-17)

`PlaceForm` asks four, and every one of them maps to a column the backend
resolves room-first (see the backend's own `JoystickRule`):

- **Which pads cost money** — a select over `"3" | "4" | "3,4"` plus "as the
  branch does" (`""`). It replaced a COUNT of pads included in the rate, which
  offered 1 and 2 to a seat that always holds two and could not say "the third
  and not the fourth" at all. A room still on the old shape keeps a `legacy`
  option, shown only to that room and only until it picks one of the three —
  offering it to everybody would be offering a setting nobody can explain.
- **The price**, editable only where the room prices its own pads. Under "as the
  branch does" the box shows the VENUE's figure, read-only, fetched with the
  branch's billing settings: a box that silently discards what is typed into it
  is worse than no box.
- **Fee or hourly rate** (`joystick_pricing_mode`) and **per handout or once for
  the seat** (`joystick_charge_mode`) — deliberately two questions and not one
  dropdown of four combinations. The first is what the money IS, the second is
  how often it lands, and a cashier who confuses them is confusing money.
- **The seat's own hourly rate**, which is a different box from the platform /
  sub-category rate beside it. The server takes the place's own rate first and
  the branch's matrix second, and a PlayStation seat that resolves to nothing —
  or to a typed `0` — is refused on save rather than at the counter, hours
  later, with the card's Start greyed out in front of a player.

**The board draws the venue's menu, never its own.** `padChoices(session.joystick_rule, openSlots)`
builds the pad menu from the SERVER's `options[]`, `padCeiling()` reads the
venue's `max_slot` (falling back to `MAX_JOYSTICKS` only for an older payload),
and the floor is `BASE_JOYSTICKS` — two, the kit a PlayStation ships with, which
no button can hand back. A once-per-seat venue gets a SWITCH instead of a menu:
one extra pad, out or not, with both halves read from the server's answer so a
socket update or another cashier's press flips it with no local state to
disagree about. `padChargeOf()` prints `n × fee` only when every charged period
agrees on a price — fees are frozen per pad, so a seat that straddles a
re-pricing holds two, and "3 × ?" would be a lie where the sum is always true.

`api/joystickPrices.ts` is the one place that fills in a default for an older
backend: `includedJoysticks`, `chargedSlotsOf`, `pricingModeOf`, `strategyModeOf`,
`maxJoystickSlotOf`, plus `CHARGED_SLOT_CHOICES`, `PRICING_MODES`,
`CHARGE_MODES`, `STRATEGY_MODES`, `BASE_JOYSTICKS` and `MAX_JOYSTICKS`. Pinned by
`PlaceForm.joystick.test.tsx`, `PlaceForm.rate.test.tsx`,
`BranchJoystickForm.test.tsx` and `SessionsBoard.expiry.test.tsx`.

**Refusals are shown verbatim.** The server answers a blocked unlimited with
"this place is booked in the app" and a missing rate with "no price is set for
joystick #3 — the owner sets it in Branch → Prices". Those are sentences an
operator can act on; a generic "failed" throws the useful half away.

**The ten-minute warning is a panel-side watcher, on purpose.**
`SessionEndingNotifier` (mounted once in `Layout`) polls
`GET /sessions?status=active` every 30s. There is no scheduler and no queue
worker on the backend deployment, so a server-side cron would be a job that
never runs — and nothing needs one, because the people who must act on the
warning are the ones in front of this screen. It is addressed correctly by
construction: that endpoint applies the caller's branch scope server-side, so an
owner sees their company and a manager their branch, and there is no client-side
filtering to get wrong. One warning per session ever (`warned`), so granting
time does not summon it again ten minutes later for a decision already made.
The card does not auto-dismiss: a booking toast that fades is a booking still
findable in a list, and a seat that goes dark under a player is not.

**`useSessionsSummary` excludes a waived session from every money figure.** It
used to compute `timeTotal` as `total_paid - items`, which for a free session is
`0 - items` — a giveaway subtracting itself from the day's time revenue. Free
sessions are still counted, and what was drunk on one is still in `itemsQty`
and the top-items list, because those describe what left the fridge rather than
what was earned.

**`session.free` the PERMISSION vs `session.free` the old i18n key.** The key
already existed and means "this seat is available" on the board. The
bill-waiver copy is prefixed `session.freeBill*` so the two can never collide —
they did, and TypeScript caught it as a duplicate object property.

---

## 10. How work must be done here (MANDATORY — run it in this order)

"100% guaranteed correct" is not achievable as a claim. It is achievable as a
method. Do not shortcut it, and do not report completion without it.

1. **Baseline BEFORE touching anything.**
   ```
   npm test            # vitest run
   npm run typecheck   # BOTH tsconfig.app.json and electron/tsconfig.json
   ```
   Record the numbers. Without a "before" there is no proof of "no regression".

2. **Check the blast radius before editing.** Anything touching an API path, a
   Reverb channel or an event name must be grepped in `cyber-place` (backend)
   first — and in the mobile app when the route is shared. `DELETE /subscribe/{id}`
   is called from here *and* from mobile, with different token types.

3. **Reuse this repo's own idiom.** `useConfirm()` not `window.confirm`;
   `NumberStepper`/`PriceInput` not `<input type="number">`; `useAsync` for
   fetch state; the `u{id}:key` prefix for anything persisted per user. A
   parallel implementation is how drift starts.

4. **Write the test, then MUTATION-VERIFY it.** Break the fix two ways, confirm
   the test fails, restore, confirm it passes. A test that does not fail on a
   broken fix proves nothing. When main-process logic needs covering, extract
   the decision into a pure module (`electron/urlPolicy.ts` is the pattern) and
   test that — Electron itself does not need to run.

5. **Re-run the full suite and both typechecks**, compare against step 1.

6. **`aikido_full_scan` every changed file.**

7. **Commit to `staging`**, security and docs separately, stating what was
   verified by running versus only reasoned about.

### The Playwright suite went dark, and how (2026-09-05)

All 7 specs failed for three unrelated reasons that had accumulated, none of
which errored — the suite simply stopped testing anything and nobody noticed.
Repaired in `e2e/` only; no production file was touched.

1. **Two language gates.** `FirstRunLanguageGate` renders an undismissable
   picker over the login screen on a machine where nobody has chosen a
   language, and `AccountLanguageGate` asks again once an account signs in. A
   fresh browser context is that machine, so every spec was clicking at a form
   behind an inert, blurred backdrop. `installBackendMocks` now seeds
   `cp.lang` / `cp.lang.chosen` / `u{id}:cp.lang` via `addInitScript` — and
   seeds them ONLY when absent, because that script re-runs on reload and would
   otherwise overwrite the choice the "survives a reload" spec had just made.
2. **`getByRole("button", { name })` is a SUBSTRING match.** The
   forgot-password panel that shipped later carries "Back to sign in", so the
   plain locator resolved to two elements and strict mode failed every click.
   `exact: true`, in every locale.
3. **The mock was pinned to the production Railway hostname** while the bundle
   resolves its API base from the environment — which is the STAGING host. No
   route matched, the mocks silently did nothing, and the specs made real
   network calls whose failures read as "wrong email or password". Routes are
   matched by a host-is-not-localhost predicate plus pathname now, so they
   cannot drift with the environment again.

Plus one race in `permissions.spec`: `page.goto("/#/revenue")` fired straight
after the Sign in click is a full document load that beat the token into
storage, so the app came up signed out. It waits for the signed-in state first.

**If you add an undismissable gate, add its seed to `installBackendMocks` in
the same change.** That is what the first hour of this went on.

### The Electron runtime is testable too (`npm run test:electron`)

`playwright.electron.config.ts` + `e2e-electron/` drive the app in REAL Electron
under Xvfb, via `_electron.launch()`. Needs `npm run build` first and nothing
else — an unpackaged main process with no `ELECTRON_DEV_URL` loads
`app://localhost/index.html` from `dist/web`.

This is the only place three things can be proven at all: the `app://` protocol
actually serving the bundle, the preload surface (`desktopAPI` /
`cyberplaceUpdates` present, `require` / `process` absent), and — the reason it
exists — **that a confirmation is an in-app React dialog and not a native
`window.confirm()`**. A native one blocks Electron's renderer and leaves the
NEXT modal's inputs unable to accept keystrokes; Chromium under Playwright just
auto-dismisses it, so the browser suite cannot see the difference. The spec
types into a second dialog opened afterwards, which is exactly where the damage
used to surface. Mutation-verified: restoring `window.confirm` fails it.

⚠️ **Always launch with a throwaway `--user-data-dir`.** Unpackaged Electron
defaults to the developer's real `userData`, and the first run of this file came
up in Russian with two real email addresses autofilled — it was reading a
person's actual profile. Note also that the KV store is a FILE reached through
the preload bridge, not `localStorage`, so the browser suite's language seeding
does nothing here; seed `cyberplace.kv.json` in the temp profile instead
(values are JSON-encoded, as `KeyValueStore.set` writes them).

**Proof ceiling here: high.** 693 vitest tests + 12 Playwright browser specs +
4 real-Electron specs + two typechecks as of 2026-09-05, so "proven" can be
earned. What cannot be:
a human click-through of the changed screens, and anything about a packaged
build's runtime behaviour. Name those as smoke-tests instead of implying a pass.

**Realtime has a pinned contract.** `src/realtime/broadcastContract.test.ts`
locks the eight event names and the channel shapes against the backend's
`tests/Unit/Events/BroadcastContractTest.php`. If either side changes, both
change in the same task — a drifted binding fails silently, with nothing in the
console.

---

_Last verified: 2026-07-18. When the panel's stack or conventions change,
update the relevant section here in the same change._
