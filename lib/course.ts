import type { Course, ClockSample } from './types';
export const CLOCK_TTL = 30_000;
export const QR_INTERVAL = 5_000;
export const WINDOW_LEAD = 25 * 60_000;
export function shanghaiDay(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replaceAll('-', '');
}
export function normalizeDay(day: string) { return day.replace(/[-/]/g, '').slice(0, 8); }
export function courseInstant(day: string, raw: string): number | null {
  let s = raw.trim().replaceAll('：', ':');
  if (!s) return null;
  const full = s.match(/^(\d{4}-\d{2}-\d{2})[T ](.+)$/);
  if (full) {
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const n = Date.parse(s.replace(' ', 'T')); return Number.isFinite(n) ? n : null; }
    day = full[1]; s = full[2];
  }
  s = s.replace(/\.\d+$/, '');
  if (/^\d{3,4}$/.test(s)) { s = s.padStart(4, '0'); s = `${s.slice(0, 2)}:${s.slice(2)}`; }
  if (/^\d{6}$/.test(s)) s = `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4)}`;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const d = normalizeDay(day);
  if (!m || !/^\d{8}$/.test(d) || +m[1] > 23 || +m[2] > 59 || +(m[3] || 0) > 59) return null;
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${m[1].padStart(2, '0')}:${m[2]}:${m[3] || '00'}+08:00`;
  const n = Date.parse(iso);
  return Number.isFinite(n) && shanghaiDay(n) === d ? n : null;
}
export function todaySorted(courses: Course[], day = shanghaiDay()) {
  return courses.filter(c => normalizeDay(c.day) === day).sort((a, b) => (courseInstant(a.day, a.beginTime) ?? Infinity) - (courseInstant(b.day, b.beginTime) ?? Infinity));
}
export function inWindow(c: Course, now: number) {
  const begin = courseInstant(c.day, c.beginTime), end = courseInstant(c.day, c.endTime);
  return begin !== null && end !== null && now >= begin - WINDOW_LEAD && now < end;
}
export function currentAndNext(courses: Course[], now: number) {
  const today = todaySorted(courses, shanghaiDay(now));
  const current = today.find(c => inWindow(c, now));
  const next = today.find(c => c.id !== current?.id && (!current || c.name !== current.name) && (courseInstant(c.day, c.beginTime) ?? 0) > (current ? courseInstant(current.day, current.beginTime) ?? now : now));
  return { current, next };
}
export function schoolNow(sample: ClockSample | null, monotonicNow: number): number | null {
  if (!sample) return null;
  const age = monotonicNow - sample.sampledAt;
  return age >= 0 && age < CLOCK_TTL ? sample.schoolAtReceive + age : null;
}
export function qrUrl(id: string, timestamp: number) {
  const value = id.trim(), compact = value.replaceAll('-', '');
  const param = /^\d{7}$/.test(value) ? 'courseSchedId' : /^[\da-f]{32}$/i.test(compact) ? 'timeTableId' : null;
  if (!param) throw new Error('请输入 7 位课程 ID 或 32 位 UUID');
  const url = new URL('https://iclass.ucas.edu.cn:8181/app/course/stu_scan_sign.action');
  url.searchParams.set(param, param === 'timeTableId' ? compact.toUpperCase() : value);
  url.searchParams.set('timestamp', String(Math.floor(timestamp)));
  return url.toString();
}
export function timeLabel(c: Course, end = false) {
  const n = courseInstant(c.day, end ? c.endTime : c.beginTime);
  return n === null ? '时间待确认' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' }).format(n);
}
