// Module service worker (registered with { type: "module" } — see
// src/registerServiceWorker.ts) so notification formatting lives in one
// place (./notification.js) shared by this worker and its unit tests.
import { buildCallNotification } from "./notification.js";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// FR-R2: show a notification for every push, whether the PWA is
// foreground, background, or closed.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const { title, options } = buildCallNotification(payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification brings an existing window to the front rather
// than always opening a new tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(focusOrOpenApp());
});

async function focusOrOpenApp() {
  const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of allClients) {
    if ("focus" in client) {
      return client.focus();
    }
  }
  return self.clients.openWindow(self.registration.scope);
}
