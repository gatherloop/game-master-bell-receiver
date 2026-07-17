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
  const rawTitle = (payload && payload.title) || "Panggilan Game Master";
  // 🔔-prefixed so it reads as urgent at a glance in a crowded notification
  // shade, without depending on a sound the OS won't let us customize.
  const title = rawTitle.startsWith("🔔") ? rawTitle : `🔔 ${rawTitle}`;
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
      // Short-short-short-long: deliberately uneven so it's felt as
      // distinct from the uniform buzz-buzz-buzz pattern most chat/social
      // apps use, since the OS notification sound itself can't be changed.
      vibrate: [80, 60, 80, 60, 80, 300, 500],
      requireInteraction: true,
      // Without this, a retried delivery sharing an existing tag (see
      // above) would silently replace the notification with no new alert
      // at all — renotify makes it re-vibrate even if one is still
      // showing. Spec requires a tag whenever renotify is true (browsers
      // throw otherwise), so this only applies when calledAt gave us one.
      renotify: Boolean(data.calledAt),
    },
  };
}
