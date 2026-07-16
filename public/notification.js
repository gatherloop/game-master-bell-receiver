/**
 * Builds the title/options for a call notification from the push payload
 * sent by the call API (PRD-v2 §3.2): `{ title, body, data: { tableCode,
 * floor, number, calledAt } }`. Falls back to constructing the body from
 * `data.number`/`data.floor` if the payload omits it, so a stripped-down
 * push still renders something useful (FR-R2).
 *
 * Plain ESM (not TypeScript) so the service worker — a hand-written module
 * script, not bundled — can `import` it directly, and so this module can
 * still be unit-tested (NFR-5) without a build step.
 */
export function buildCallNotification(payload) {
  const data = (payload && payload.data) || {};
  const title = (payload && payload.title) || "Panggilan Game Master";
  const body =
    (payload && payload.body) ||
    `Meja ${data.number ?? "?"} · Lantai ${data.floor ?? "?"} memanggil game master`;

  return {
    title,
    options: {
      body,
      data,
      // Distinct calls get distinct tags (so they stack); retried delivery
      // of the *same* call shares a tag and collapses into one notification.
      tag: data.calledAt ? `call-${data.calledAt}` : undefined,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
    },
  };
}
