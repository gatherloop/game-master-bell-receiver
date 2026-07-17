# Runbook — Deploys & Operations

Operational reference for this repo. See
[`gatherloop/game-master-bell`'s `docs/PRD-v2.md`](https://github.com/gatherloop/game-master-bell/blob/main/docs/PRD-v2.md)
for the current architecture and the **R** (receiver) implementation phases.

As of phase **R2**, the app has a working subscribe flow (FR-R1, FR-R4): a
staff member taps "Berlangganan", grants notification permission, enters
the staff passcode once, and the app subscribes via the Push API and
registers that subscription with the call API. The status screen reflects
subscription state (not subscribed / subscribed / permission denied) and
offers an unsubscribe action.

As of phase **R3**, `public/sw.js` handles incoming pushes end to end
(FR-R2): its `push` listener parses the API's payload and calls
`showNotification` with the table/floor text and a vibration pattern,
whether the PWA is foreground, background, or fully closed; its
`notificationclick` listener closes the notification and focuses an
existing app window (or opens one) so tapping it brings the PWA to the
front. The notification content is built by `public/notification.js`, a
plain-JS module the service worker imports directly (it is registered with
`{ type: "module" }` — see `src/registerServiceWorker.ts`) and that
`tests/notification.test.js` also imports, so the payload-formatting logic
is unit-tested (NFR-5) without needing a build step for the worker itself.

Since web push has no standard way to set a custom *system* notification
sound (browsers dropped the spec's `sound` option; on Android the OS/browser
default always plays), `buildCallNotification` instead leans on the levers
that *are* available: an uneven, deliberately non-uniform `vibrate` pattern
so a call is felt as distinct from other apps' notifications; a
🔔-prefixed title for quick visual recognition in a crowded notification
shade; `requireInteraction: true` so it doesn't auto-dismiss; and
`renotify: true` (only possible when `calledAt` gives a `tag` — the spec
requires one) so a second call re-alerts instead of silently replacing an
unread one. `src/lib/callSound.ts` adds one more option on top: a
synthesized chime played via the Web Audio API whenever a call arrives
*while the app tab is open* (wired up in `src/app.ts`'s
`subscribeToRecentCalls` callback below) — the one case where the page's
own JS runs instead of the OS handling the notification silently. Browsers
require a user gesture before audio will play, so `primeCallSound()` is
called from the subscribe button's click handler to unlock the
`AudioContext` ahead of time.

As of phase **R4**, every push also persists a record (table, floor,
number, calledAt, receivedAt) to an IndexedDB database (`gm-bell-receiver`,
store `calls`) via `public/recent-calls.js` — the same plain-JS-module
pattern as `notification.js`, since the service worker can only `import`
unbundled JS. It keeps only the most recent 50 calls, pruning older ones
after each write. The status screen (`src/app.ts`, backed by
`src/lib/recentCalls.ts`) reads that same IndexedDB database to render a
"Panggilan Terbaru" list, newest first, and refreshes live while the app
stays open: `public/recent-calls.js` posts each new record on a
`BroadcastChannel` (`gm-bell-recent-calls`), which `src/lib/recentCalls.ts`
subscribes to. `DB_NAME`/`DB_VERSION`/`STORE_NAME`/the channel name are
duplicated (not imported) between the two modules — one is unbundled plain
JS loaded directly by the browser, the other is bundled TypeScript — so a
schema change needs updating both; `tests/recentCalls.test.js` seeds data
through the service worker's module and reads it back through the app's
module to guard against them drifting apart.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the call API (no trailing slash), e.g. `https://bell-api.gatherloop.id`. Used for `GET /vapid-key`, `POST /subscriptions`, `DELETE /subscriptions`. See `.env.example`. |

Copy `.env.example` to `.env.local` (gitignored) to point at a local or
staging API; `.env.development` provides the `pnpm dev` default.

## Prerequisites

- Node.js 22 (`.nvmrc` pins the version) and pnpm 10 (`packageManager` in
  `package.json` — run via `corepack enable` or install pnpm directly).
- `pnpm install` before running anything.

## Local development

```sh
pnpm dev
```

Vite serves the app at `http://localhost:5173`. Service workers require
HTTPS in production, but `localhost` is treated as a secure context by
browsers, so the service worker registers fine in dev.

## Checks

```sh
pnpm lint          # eslint
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm format:check  # prettier --check
pnpm build         # vite build -> dist/
```

These are intended to run in CI on every push and pull request, but no
`.github/workflows/` exist in this repo yet (see Known gaps below) — run
them locally before pushing.

## Deploying

Pushing to `main` (or running the workflow manually) triggers
`.github/workflows/deploy.yml`: it builds the app with `pnpm build` and
publishes `dist/` to GitHub Pages
(`https://gatherloop.github.io/game-master-bell-receiver/`) via
`actions/upload-pages-artifact` + `actions/deploy-pages`.

Two one-time repo settings are required for this to work:

- **Settings → Pages → Source**: set to "GitHub Actions" (not "Deploy from
  a branch").
- **Settings → Secrets and variables → Actions → Secrets**: add a
  `VITE_API_URL` secret with the production call API URL (e.g.
  `https://bell-api.gatherloop.id`). The workflow passes it as a build-time
  env var to `pnpm build`, same as `.env.local` does locally — Vite only
  inlines `VITE_`-prefixed vars at build time, so this must be set before
  the `pnpm build` step, not read at runtime. `vite build` runs in
  `production` mode, which does not load `.env.development` (that file is
  dev-server-only), so an unset secret means `VITE_API_URL` is `undefined`
  in the deployed bundle and every API call breaks — always confirm the
  secret is set after first enabling this workflow.

To verify a deploy: open the Pages URL on a phone and confirm the browser
offers "Add to Home Screen" / an install prompt (the manifest + icons +
registered service worker are what make it installable — see
`public/site.webmanifest`, `public/sw.js`).

## Known gaps

- **No CI workflow** — the Pages deploy workflow (`.github/workflows/deploy.yml`)
  now exists, but a separate CI workflow running the **Checks** above
  (lint/typecheck/test/format) on every push and pull request has not been
  added yet. Run those commands locally before pushing until it is.

## Regenerating the icon set

The PWA icons (`public/icon-*.png`, `public/favicon-*.png`,
`public/apple-touch-icon.png`) are generated by a small script rather than
checked-in design assets, since no image tooling (ImageMagick, sharp, etc.)
is assumed to be available:

```sh
node scripts/generate-icons.mjs
```

Edit the shape/palette constants at the top of `scripts/generate-icons.mjs`
(kept in sync with the bell app's `favicon.svg` colors) and re-run to
regenerate all sizes, including the maskable variant.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| App doesn't offer "Add to Home Screen" | Not served over HTTPS (or `localhost`), manifest/icon 404, or the service worker failed to register — check the browser's application/manifest devtools panel. |
| Deploy workflow fails on `pnpm build` | Run `pnpm build` locally first; the workflow uses the same `--frozen-lockfile` install, so a stale `pnpm-lock.yaml` will fail there too. |
| Status stuck on "Izin notifikasi ditolak" | Browser-level notification permission was denied for this origin. It can't be re-prompted from the page — the user has to clear it in the browser's site settings, then reload. |
| Passcode form reappears every time | The passcode is only saved to `localStorage` *after* the API accepts it (a rejected passcode is never persisted) — a wrong passcode, or `VITE_API_URL` pointing at a dead/unreachable API, means it never gets past that point. Check the network tab for the `POST /subscriptions` response. |
| "Gagal mengambil kunci VAPID" / subscribe never completes | `GET /vapid-key` failed or `VITE_API_URL` is misconfigured — confirm the API is up and CORS allows this origin (FR-A4). If subscribing fails partway through, the app unsubscribes the local `PushSubscription` again before showing the error, so it shouldn't get stuck "subscribed" locally with no matching API row. |
| Status shows "Berlangganan" but the device never gets calls | The app treats *any* existing browser-level `PushSubscription` as "subscribed" on load — it doesn't re-verify the row still exists server-side. If the API pruned it (FR-A6, a dead subscription) or it was deleted out-of-band, the status screen won't notice until the user explicitly unsubscribes and re-subscribes. |
| Subscribed device doesn't show a notification on a call | Confirm `reg.active.scriptURL` in devtools application panel shows `sw.js` loaded as a **module** worker (Chrome DevTools → Application → Service Workers); an old browser without module-worker support won't run `public/sw.js`'s `import`. Otherwise check the push payload the API actually sent — `event.data.json()` failing (non-JSON body) falls back to a generic "Panggilan Game Master" notification with no table/floor rather than throwing, so a wrong-looking notification usually means an API payload shape mismatch, not a receiver bug. |
| Notification arrives but "Panggilan Terbaru" doesn't show it | Check the Application → IndexedDB devtools panel for a `gm-bell-receiver` database with a `calls` store — if it's missing or empty despite notifications arriving, `public/recent-calls.js`'s `addRecentCall` is failing silently inside `event.waitUntil` (check the service worker's console, e.g. private/incognito windows in some browsers restrict IndexedDB). If the row is there but the open app doesn't update without a manual reload, the live-update path (`BroadcastChannel("gm-bell-recent-calls")`) isn't delivering — it's best-effort only; a reload always re-reads IndexedDB directly. |
