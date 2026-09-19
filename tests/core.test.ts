import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { courseInstant, currentAndNext, qrUrl, schoolNow, shanghaiDay, todaySorted } from '../lib/course';
import { openSession, sealSession, profile } from '../lib/session-crypto';
import { getCourses, getClock, login, parseSign, parseWeek, submitAttendance } from '../lib/school';
import { body, checkOrigin } from '../lib/http';
import type { Course } from '../lib/types';
const session = { userId: 'user-a', sessionId: 'secret-school-token', studentNo: '2026123456' };
const course = (id: string, day = '20260919', beginTime = '10:30', name = '学术英语'): Course => ({ id, day, beginTime, endTime: '12:10', uuid: '', name, teacher: '教师', signed: false });
const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
beforeEach(() => { vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('base64')); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Shanghai course calendar', () => {
  it('changes dates at Shanghai midnight, regardless of host timezone', () => { expect(shanghaiDay(Date.parse('2026-09-18T16:00:00Z'))).toBe('20260919'); });
  it.each(['8:00', '08:00:00', '0800', '080000', '8：00', '2026-09-19 08:00:00.000', '2026-09-19T00:00:00Z'])('parses %s', raw => { expect(courseInstant('20260919', raw)).toBe(Date.parse('2026-09-19T00:00:00Z')); });
  it('rejects invalid dates and times', () => { expect(courseInstant('20260230', '08:00')).toBeNull(); expect(courseInstant('20260919', '25:00')).toBeNull(); expect(courseInstant('', '08:00')).toBeNull(); });
  it('does not treat another day as today', () => { expect(todaySorted([course('1', '20260920')], '20260919')).toEqual([]); });
  it('finds current and skips the same-name continuation for next', () => {
    const list = [course('1'), { ...course('2', '20260919', '12:30'), endTime: '13:10' }, course('3', '20260919', '13:30', '科学方法')];
    const result = currentAndNext(list, courseInstant('20260919', '10:05')!); expect(result.current?.id).toBe('1'); expect(result.next?.id).toBe('3');
    expect(currentAndNext(list, courseInstant('20260919', '10:04')!).current).toBeUndefined();
  });
});
describe('authenticated encryption', () => {
  it('round trips without exposing school tokens', () => { const sealed = sealSession(session, 1000); expect(sealed).not.toContain(session.sessionId); expect(openSession(sealed, 1001)).toEqual(session); });
  it('rejects tampering, expired sessions and key rotation', () => {
    const sealed = sealSession(session, 1000); const bytes = Buffer.from(sealed, 'base64url'); bytes[30] ^= 1;
    expect(openSession(bytes.toString('base64url'), 1001)).toBeNull(); expect(openSession(sealed, 1000 + 7 * 86400_000)).toBeNull();
    vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('base64')); expect(openSession(sealed, 1001)).toBeNull();
  });
  it('isolates local cache identity and masks the school account', () => { expect(profile(session).accountKey).not.toBe(profile({ ...session, userId: 'other' }).accountKey); expect(profile(session).label).toBe('•••• 3456'); expect(JSON.stringify(profile(session))).not.toContain(session.sessionId); });
});
describe('clock and QR', () => {
  it('expires at 30 seconds and rejects negative monotonic age', () => { const s = { schoolAtReceive: 1000, sampledAt: 100, rtt: 10 }; expect(schoolNow(s, 200)).toBe(1100); expect(schoolNow(s, 30100)).toBeNull(); expect(schoolNow(s, 99)).toBeNull(); });
  it('encodes only supported ids and never includes identity', () => { expect(qrUrl('1234567', 123)).toContain('courseSchedId=1234567'); expect(qrUrl('abcdabcd-abcd-abcd-abcd-abcdabcdabcd', 123)).toContain('timeTableId=ABCDABCDABCDABCDABCDABCDABCDABCD'); expect(() => qrUrl('https://evil.test', 123)).toThrow(); expect(new URL(qrUrl('1234567', 123)).searchParams.has('id')).toBe(false); });
  it('rejects invalid school clock data', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ STATUS: '0', timestamp: 'bad' }))); await expect(getClock()).rejects.toMatchObject({ code: 'CLOCK_INVALID' }); });
});
describe('school adapter', () => {
  it('treats a successful empty week as empty, not failure', () => { expect(parseWeek({ STATUS: '0', result: [] }, '20260919').courses).toEqual([]); });
  it('keeps weekly courses distinct from today', () => { const result = parseWeek({ STATUS: '0', result: [{ dateStr: '2026-09-20', schedData: [{ id: '1234567', courseName: '明天课程' }] }] }, '20260919'); expect(result.courses).toEqual([]); expect(result.weeklyCourses).toHaveLength(1); });
  it('does not silently turn a rejected schedule into no classes', () => { expect(() => parseWeek({ STATUS: '1', result: [] }, '20260919')).toThrow(); });
  it('falls back from an empty day to the week with trusted identity', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ STATUS: '0', result: [] })).mockResolvedValueOnce(reply({ STATUS: '0', result: [] })); vi.stubGlobal('fetch', fetcher);
    expect((await getCourses(session, '20260919')).fromWeeklyFallback).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls[0][1].body.get('id')).toBe(session.userId);
  });
  it('rejects incorrect credentials and expired sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ STATUS: '1', ERRMSG: '密码错误' }))); await expect(login('user', 'bad')).rejects.toMatchObject({ code: 'LOGIN_REJECTED' });
    expect(() => parseSign({ ERRMSG: '登录已过期' })).toThrow('学校登录已失效');
  });
  it('does not infer success from HTTP 200 or STATUS alone', () => {
    expect(parseSign({ STATUS: '0' }).outcome).toBe('unknown'); expect(parseSign({ STATUS: '0', result: { stuSignStatus: '1' }, success: false }).outcome).toBe('unknown');
    expect(parseSign({ STATUS: '0', result: { stuSignStatus: '1' } }).outcome).toBe('signed'); expect(parseSign({ ERRMSG: '二维码已过期' }).outcome).toBe('expired'); expect(parseSign({ ERRMSG: '已签到' }).outcome).toBe('already_signed');
  });
  it('reconciles a lost sign response without sending another sign request', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ STATUS: '0', timestamp: Date.now() })).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(reply({ STATUS: '0', result: [{ id: '1234567', courseName: '课', signStatus: '1' }] }));
    vi.stubGlobal('fetch', fetcher); expect((await submitAttendance(session, '1234567')).outcome).toBe('signed'); expect(fetcher.mock.calls.filter(([url]) => String(url).includes('stu_scan_sign'))).toHaveLength(1);
  });
});
describe('request boundary', () => {
  it('rejects cross-site POSTs and accepts the configured origin', () => { vi.stubEnv('APP_ORIGIN', 'https://mengsign.cdro.tech'); expect(() => checkOrigin(new Request('https://mengsign.cdro.tech/api/auth/login', { headers: { Origin: 'https://other.test' } }))).toThrow(); expect(() => checkOrigin(new Request('https://mengsign.cdro.tech/api/auth/login', { headers: { Origin: 'https://mengsign.cdro.tech' } }))).not.toThrow(); });
  it('rejects oversized and non-object JSON', async () => { const request = (s: string) => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s }); await expect(body(request('[]'))).rejects.toMatchObject({ status: 400 }); await expect(body(request(' '.repeat(5000)))).rejects.toMatchObject({ status: 413 }); });
});
