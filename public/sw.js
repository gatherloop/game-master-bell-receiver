// Empty placeholder service worker (R1 scaffold). It exists so the app is
// installable and a service-worker registration is in place before push
// handling and notification display land in R3 (FR-R2).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
