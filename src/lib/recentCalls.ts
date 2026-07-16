/**
 * Reads the recent-calls list the service worker writes to IndexedDB on
 * every push (see public/recent-calls.js — DB_NAME/DB_VERSION/STORE_NAME
 * must stay in sync with that module). FR-R3.
 */
const DB_NAME = "gm-bell-receiver";
const DB_VERSION = 1;
const STORE_NAME = "calls";
const RECENT_CALLS_CHANNEL = "gm-bell-recent-calls";
const DEFAULT_LIMIT = 20;

export interface RecentCall {
  tableCode: string | null;
  floor: string | null;
  number: string | null;
  calledAt: string | null;
  receivedAt: string;
}

function openDb(): Promise<IDBDatabase> {
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

/** Stored calls, most recently received first. */
export async function getRecentCalls(limit = DEFAULT_LIMIT): Promise<RecentCall[]> {
  const db = await openDb();
  const records = await new Promise<RecentCall[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as RecentCall[]);
    request.onerror = () => reject(request.error);
  });
  db.close();

  // Insertion (id) order is oldest-first; reverse for newest-first display.
  return records.slice().reverse().slice(0, limit);
}

/** Invokes `onCall` whenever the service worker stores a new call while this page is open. */
export function subscribeToRecentCalls(onCall: (call: RecentCall) => void): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const channel = new BroadcastChannel(RECENT_CALLS_CHANNEL);
  channel.onmessage = (event: MessageEvent<RecentCall>) => onCall(event.data);
  return () => channel.close();
}
