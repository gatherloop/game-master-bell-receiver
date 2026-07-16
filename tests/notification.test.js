import { describe, expect, it } from "vitest";
import { buildCallNotification } from "../public/notification.js";

describe("buildCallNotification", () => {
  it("uses the title/body the API sent as-is", () => {
    const { title, options } = buildCallNotification({
      title: "Panggilan Game Master",
      body: "Meja 5 · Lantai 2 memanggil game master",
      data: { tableCode: "2-05", floor: "2", number: "5", calledAt: "2026-07-16T10:00:00.000Z" },
    });

    expect(title).toBe("Panggilan Game Master");
    expect(options.body).toBe("Meja 5 · Lantai 2 memanggil game master");
    expect(options.data.tableCode).toBe("2-05");
    expect(options.tag).toBe("call-2026-07-16T10:00:00.000Z");
  });

  it("falls back to a constructed title/body when the payload omits them", () => {
    const { title, options } = buildCallNotification({
      data: { tableCode: "1-03", floor: "1", number: "3" },
    });

    expect(title).toBe("Panggilan Game Master");
    expect(options.body).toBe("Meja 3 · Lantai 1 memanggil game master");
    expect(options.tag).toBeUndefined();
  });

  it("handles a missing/empty push payload without throwing", () => {
    const { title, options } = buildCallNotification(undefined);

    expect(title).toBe("Panggilan Game Master");
    expect(options.body).toContain("Meja ?");
    expect(options.data).toEqual({});
  });

  it("gives distinct calls distinct tags so notifications stack", () => {
    const first = buildCallNotification({ data: { calledAt: "2026-07-16T10:00:00.000Z" } });
    const second = buildCallNotification({ data: { calledAt: "2026-07-16T10:05:00.000Z" } });

    expect(first.options.tag).not.toBe(second.options.tag);
  });
});
