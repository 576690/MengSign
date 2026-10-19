import type { TimetableResult } from "./types";
const PREFIX = "mengsign:timetable:";
export function readTimetable(
  account: string,
  weekStart: string,
): TimetableResult | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`${PREFIX}${account}:${weekStart}`) || "null",
    );
    if (
      parsed?.weekStart !== weekStart ||
      typeof parsed.weekEnd !== "string" ||
      !Number.isFinite(parsed.updatedAt) ||
      !Array.isArray(parsed.courses)
    )
      return null;
    if (
      !parsed.courses.every(
        (c: Record<string, unknown>) =>
          c &&
          [
            "id",
            "uuid",
            "name",
            "teacher",
            "beginTime",
            "endTime",
            "day",
          ].every((k) => typeof c[k] === "string") &&
          typeof c.signed === "boolean",
      )
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
export function clearTimetable() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
export function writeTimetable(account: string, data: TimetableResult) {
  try {
    clearTimetable();
    localStorage.setItem(
      `${PREFIX}${account}:${data.weekStart}`,
      JSON.stringify(data),
    );
  } catch {}
}
