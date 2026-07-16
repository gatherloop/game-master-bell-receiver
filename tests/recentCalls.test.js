import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { getRecentCalls, subscribeToRecentCalls } from "../src/lib/recentCalls";
// Seeds the same IndexedDB schema via the service worker's module, proving
// the two independently-implemented modules stay interoperable.
import { addRecentCall } from "../public/recent-calls.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("getRecentCalls", () => {
  it("returns an empty list when nothing has been received yet", async () => {
    expect(await getRecentCalls()).toEqual([]);
  });

  it("returns stored calls newest first", async () => {
    await addRecentCall({ tableCode: "1-01", floor: "1", number: "1" });
    await addRecentCall({ tableCode: "2-02", floor: "2", number: "2" });

    const calls = await getRecentCalls();
    expect(calls.map((call) => call.tableCode)).toEqual(["2-02", "1-01"]);
  });

  it("limits the result to the given count", async () => {
    for (let i = 0; i < 5; i++) {
      await addRecentCall({ tableCode: `t-${i}`, floor: "1", number: String(i) });
    }

    const calls = await getRecentCalls(2);
    expect(calls.map((call) => call.tableCode)).toEqual(["t-4", "t-3"]);
  });
});

describe("subscribeToRecentCalls", () => {
  it("invokes the callback when a new call is stored", async () => {
    const onCall = vi.fn();
    const unsubscribe = subscribeToRecentCalls(onCall);

    await addRecentCall({ tableCode: "3-03", floor: "3", number: "3" });
    await vi.waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

    expect(onCall.mock.calls[0][0]).toMatchObject({ tableCode: "3-03" });
    unsubscribe();
  });
});
