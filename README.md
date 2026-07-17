# game-master-bell-receiver

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
