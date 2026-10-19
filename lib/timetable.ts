import { courseInstant, normalizeDay, shanghaiDay } from "./course";
import type { Course } from "./types";

export function weekDays(day = shanghaiDay()): string[] {
  const midday = courseInstant(day, "12:00");
  if (midday === null) throw new Error("日期无效");
  const weekday = new Date(midday + 8 * 3600_000).getUTCDay();
  const monday = midday - ((weekday + 6) % 7) * 86400_000;
  return Array.from({ length: 7 }, (_, i) =>
    shanghaiDay(monday + i * 86400_000),
  );
}
export function isOngoing(course: Course, now: number) {
  const begin = courseInstant(course.day, course.beginTime);
  const end = courseInstant(course.day, course.endTime);
  return begin !== null && end !== null && begin <= now && now < end;
}
export function dateLabel(day: string) {
  const d = normalizeDay(day);
  return `${Number(d.slice(4, 6))}月${Number(d.slice(6, 8))}日`;
}
