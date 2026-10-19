import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { weekDays, isOngoing } from "../lib/timetable";
import { parseTimetable, getTimetable } from "../lib/school";
import { courseInstant } from "../lib/course";
import { readTimetable, writeTimetable } from "../lib/timetable-cache";
import { clearPersonal, writeCache } from "../lib/client";
vi.mock("../lib/transport", () => ({
  schoolFetch: (url: string, init: RequestInit) => fetch(url, init),
}));
const row = {
  id: "1234567",
  courseName: "学术英语",
  teacherName: "示例教师",
  classBeginTime: "10:30",
  classEndTime: "12:10",
  signStatus: "0",
};
const raw = {
  STATUS: "0",
  result: [{ dateStr: "2026-10-19", schedData: [row] }],
};
afterEach(() => vi.unstubAllGlobals());
describe("weekly schedule", () => {
  it("uses Monday to Sunday across year boundaries", () => {
    expect(weekDays("20270103")).toEqual([
      "20261228",
      "20261229",
      "20261230",
      "20261231",
      "20270101",
      "20270102",
      "20270103",
    ]);
    expect(weekDays("20261019")[0]).toBe("20261019");
  });
  it("returns only the requested current week and keeps empty weeks valid", () => {
    expect(parseTimetable(raw, "20261020").courses[0].name).toBe("学术英语");
    expect(
      parseTimetable({ STATUS: "0", result: [] }, "20261020").courses,
    ).toEqual([]);
  });
  it("distinguishes failures, malformed dates, and wrong-week responses from no classes", () => {
    expect(() =>
      parseTimetable({ STATUS: "1", result: [] }, "20261020"),
    ).toThrow();
    expect(() =>
      parseTimetable(
        { STATUS: "0", result: [{ dateStr: "bad", schedData: [] }] },
        "20261020",
      ),
    ).toThrow();
    expect(() => parseTimetable(raw, "20261101")).toThrow("不属于本周");
  });
  it("queries the week directly with server session identity, even when today has courses", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(raw)));
    vi.stubGlobal("fetch", fetcher);
    await getTimetable(
      { userId: "owner", sessionId: "session", studentNo: "123" },
      "20261020",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain(
      "get_stu_course_sched_week.action",
    );
    expect(fetcher.mock.calls[0][1].body.get("id")).toBe("owner");
    expect(fetcher.mock.calls[0][1].body.get("dateStr")).toBe("20261020");
  });
  it("highlights actual class time rather than the early sign window", () => {
    const c = parseTimetable(raw, "20261019").courses[0];
    expect(isOngoing(c, courseInstant(c.day, "10:10")!)).toBe(false);
    expect(isOngoing(c, courseInstant(c.day, "10:30")!)).toBe(true);
    expect(isOngoing(c, courseInstant(c.day, "12:10")!)).toBe(false);
  });
});
describe("weekly local cache", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    Object.defineProperties(storage, {
      getItem: { value: (k: string) => storage[k] ?? null },
      setItem: {
        value: (k: string, v: string) => {
          storage[k] = v;
        },
      },
      removeItem: {
        value: (k: string) => {
          delete storage[k];
        },
      },
    });
    vi.stubGlobal("localStorage", storage);
  });
  it("isolates accounts and weeks and is cleared at logout", () => {
    const data = parseTimetable(raw, "20261019");
    writeTimetable("a", data);
    expect(readTimetable("a", "20261019")?.courses).toHaveLength(1);
    expect(readTimetable("b", "20261019")).toBeNull();
    expect(readTimetable("a", "20261026")).toBeNull();
    clearPersonal();
    expect(readTimetable("a", "20261019")).toBeNull();
  });
  it("survives ordinary daily refreshes without mixing cache types", () => {
    writeTimetable("a", parseTimetable(raw, "20261019"));
    writeCache("a", {
      date: "20261019",
      courses: [],
      weeklyCourses: [],
      fromWeeklyFallback: false,
      updatedAt: 1,
    });
    expect(readTimetable("a", "20261019")?.courses).toHaveLength(1);
  });
});
