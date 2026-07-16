import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { addRecentCall, RECENT_CALLS_CHANNEL } from "../public/recent-calls.js";

// A fresh in-memory IndexedDB per test so calls from one test don't leak
// into the next (fake-indexeddb otherwise persists for the process).
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("addRecentCall", () => {
  it("stores the call's table/floor/number/calledAt plus a receivedAt timestamp", async () => {
    const record = await addRecentCall({
      tableCode: "2-05",
      floor: "2",
      number: "5",
      calledAt: "2026-07-16T10:00:00.000Z",
    });

    expect(record).toMatchObject({
      tableCode: "2-05",
      floor: "2",
      number: "5",
      calledAt: "2026-07-16T10:00:00.000Z",
    });
    expect(typeof record.receivedAt).toBe("string");
  });

  it("falls back to null fields for a missing/empty payload", async () => {
    const record = await addRecentCall({});

    expect(record.tableCode).toBeNull();
    expect(record.floor).toBeNull();
    expect(record.number).toBeNull();
    expect(record.calledAt).toBeNull();
  });

  it("broadcasts the stored record on the recent-calls channel", async () => {
    const channel = new BroadcastChannel(RECENT_CALLS_CHANNEL);
    const received = new Promise((resolve) => {
      channel.onmessage = (event) => resolve(event.data);
    });

    await addRecentCall({ tableCode: "1-01", floor: "1", number: "1" });

    expect((await received).tableCode).toBe("1-01");
    channel.close();
  });

  it("prunes older calls once more than 50 are stored", async () => {
    for (let i = 0; i < 55; i++) {
      await addRecentCall({ tableCode: `t-${i}`, floor: "1", number: String(i) });
    }

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gm-bell-receiver", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise((resolve, reject) => {
      const request = db.transaction("calls", "readonly").objectStore("calls").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(all).toHaveLength(50);
    expect(all[0].tableCode).toBe("t-5");
    expect(all[49].tableCode).toBe("t-54");
  });
});
