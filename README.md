# game-master-bell-receiver

> **⚠️ Archived — read-only.** The receiver PWA described in this repo has
> been retired in favor of the native Android app at
> [`apps/receiver-android` in `gatherloop/game-master-bell`](https://github.com/gatherloop/game-master-bell/tree/main/apps/receiver-android),
> per [PRD-v3](https://github.com/gatherloop/game-master-bell/blob/main/docs/PRD-v3.md).
> Every staff phone now runs the native app, the API's Web Push path was
> removed in PRD-v3 phase 9, and this repo's `.github/workflows/deploy.yml`
> has been removed — the GitHub Pages site it published is being taken
> down. Everything below describes this repo as it stood before retirement
> — kept for history, not for active use. File issues and PRs against the
> monorepo instead.

Receiver PWA for Game Master Bell — installed on game master phones at
Gatherloop Board Game Cafe to receive bell calls from customer tables.

See [`gatherloop/game-master-bell`'s `docs/PRD-v2.md`](https://github.com/gatherloop/game-master-bell/blob/main/docs/PRD-v2.md)
for the full product/architecture spec and implementation phases (this repo
covers the **R** phase track), and `docs/RUNBOOK.md` in this repo for
deploy/dev instructions.

**Status:** R4 (recent-calls list). Notification permission → staff
passcode → push subscription, registered with the call API; status screen
and unsubscribe action (R2). Incoming pushes show a notification with
table/floor, a distinct vibration pattern, a bell-prefixed title, and a
tap-to-focus action, whether the PWA is foreground, background, or closed
(R3) — repeated calls always re-alert (`renotify`) rather than silently
replacing an unread one, and a custom chime also plays if the app tab is
open, since web push has no way to set a custom *system* notification
sound. Every received call is now also persisted to IndexedDB and rendered
as a recent-calls list on the status screen, updating live while the app is
open (R4).

## Stack

Vite + TypeScript (vanilla), hand-written service worker, deployed to
GitHub Pages via Actions.

## Development

```sh
corepack enable   # or install pnpm directly
pnpm install
pnpm dev
```

See `docs/RUNBOOK.md` for build, lint, and deploy commands.
