/**
 * Shared IndexedDB schema for the recent-calls list (FR-R3). The service
 * worker (./sw.js) writes a record here on every push; the app
 * (../src/lib/recentCalls.ts) reads them back to render the list. Keep
 * DB_NAME/DB_VERSION/STORE_NAME in sync between the two modules — they
 * can't share an import since this one is loaded unbundled by the service
 * worker and that one is bundled TypeScript.
 *
 * Plain ESM (like ./notification.js) so it can be imported directly by the
 * service worker and unit-tested (NFR-5) without a build step.
 */
const DB_NAME = "gm-bell-receiver";
const DB_VERSION = 1;
const STORE_NAME = "calls";
const MAX_STORED_CALLS = 50;

export const RECENT_CALLS_CHANNEL = "gm-bell-recent-calls";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Stores a received call's data (from the push payload's `data` field) and prunes older entries. */
export async function addRecentCall(data) {
  const record = {
    tableCode: (data && data.tableCode) ?? null,
    floor: (data && data.floor) ?? null,
    number: (data && data.number) ?? null,
    calledAt: (data && data.calledAt) ?? null,
    receivedAt: new Date().toISOString(),
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await pruneOldCalls(db);
  db.close();

  try {
    new BroadcastChannel(RECENT_CALLS_CHANNEL).postMessage(record);
  } catch {
    // BroadcastChannel isn't available in every environment — the app
    // still picks the call up from IndexedDB on its next load.
  }

  return record;
}

async function pruneOldCalls(db) {
  const keys = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const excess = keys.length - MAX_STORED_CALLS;
  if (excess <= 0) {
    return;
  }

  // getAllKeys() on an autoIncrement store returns keys in ascending
  // (oldest-first) order, so the first `excess` keys are the oldest.
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const key of keys.slice(0, excess)) {
      store.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
