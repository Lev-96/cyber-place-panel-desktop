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
  `contextBridge`: `desktopAPI` (kv-store + Wake-on-LAN) and
  `cyberplaceUpdates`.
- 7 `ipcMain.handle` channels total: `kv:get|set|remove`, `wol:send`,
  `updates:check|install|getState`.
- Custom `app://` protocol — no `file://` disclosure.

### Feature areas (folders under `src/`)
`bookings · branches · companies · games · live · managers · members · pcs ·
pos · places · sessions · tournaments · revenue · services · scanner`

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

### Project-specific traps (memorise)
- **Typecheck command:** ALWAYS run both
  `tsc -p tsconfig.app.json --noEmit` **and** `tsc -p electron/tsconfig.json --noEmit`.
  The root `tsconfig.json` silently misses `src/` errors that CI catches.
  Use the `npm run typecheck` script which does both.
- **Number inputs:** never use raw `<input type="number">` — Electron
  swallows keystrokes. Use the `NumberStepper` primitive (text +
  `inputMode="decimal"`).
- **Confirm dialogs:** never use native `window.confirm()` — it poisons
  renderer focus on Linux WMs. Use the in-app `ConfirmDialog`.
- **DevTools:** auto-detached DevTools also break renderer focus. Gate
  with `ELECTRON_DEVTOOLS=1` env var.
- **i18n:** language codes are `en` / `ru` / `am` (NOT `hy`). Use the
  `t()` helper from `LanguageContext` and `money()` for currency.
  Watch for duplicate translation keys.
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
| `branch.{id}` | public | manager: booking + place + tournament + branch-subscribe events for one venue |
| `company.{id}` | public | owner: same scoped to a whole company |
| `bookings.global` | public | admin: same for admin-wide visibility |
| `app-updates` | public | promoted-version broadcasts |
| `app-updates.{role}` | public | release-available per role |
| `user.{id}.notifications` | **private** (wire: `private-user.{id}.notifications`) | per-user notification feed |

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
| `UserNotificationCreated` | `notification.created` | user.{id}.notifications |
| `AppReleaseAvailable` | `app-release.available` | app-updates.{role} |
| `AppUpdatePromoted` | `app-update.promoted` | app-updates |

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
   subscriber. `leaveChannel` is only safe on hook-owned channels (e.g.
   `useAppUpdates` on `app-updates`).
10. **No HTTP refresh inside a Reverb event handler.** Optimistic-patch
    local state from the payload; periodic polling (30–60 s) handles
    canonical reconciliation.
11. **Polling fallback is mandatory** on every realtime-critical screen
    (`useReservedPlaceIds`, `NotificationsContext` etc.) — 30–60 s. Reverb
    dropouts are silent; polling is the safety net.
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

---

_Last verified: 2026-05-28. When the panel's stack or conventions change,
update the relevant section here in the same change._
