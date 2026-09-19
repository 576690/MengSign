// Protocol adapted from zhan-nine/UCAS-Sign-in and lccipher/UCAS-Course-Sign-in.
// AGPL-3.0-only. Web adaptation: explicit response validation, no identity-only login.
import type { Course, CourseResult, SchoolSession, SignResult } from './types';
import { normalizeDay, shanghaiDay, todaySorted } from './course';
import { AppError } from './errors';
export const SCHOOL_BASE = 'https://iclass.ucas.edu.cn:8181/app/';
const UA = 'student_5.0.1.2_android_12_20_100000000000000_110000';
type Obj = Record<string, unknown>;
function obj(value: unknown): Obj { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function str(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
export function checkAuth(value: Obj) {
  const msg = [value.ERRMSG, value.msg, value.message].map(str).join(' ');
  if (/未登录|重新登录|登录.*(失效|过期)|session.*(expired|invalid)|not.*logged/i.test(msg)) throw new AppError('LOGIN_EXPIRED', '学校登录已失效，请重新登录', 401);
}
export async function schoolRequest(path: string, options: { session?: SchoolSession; form?: Record<string, string>; timeout?: number; login?: boolean } = {}): Promise<Obj> {
  try {
    const response = await fetch(SCHOOL_BASE + path, {
      method: options.form ? 'POST' : 'GET',
      headers: { 'User-Agent': options.login ? 'student_5.0.1.2_android_12_20__110000' : UA, 'Cache-Control': 'no-store', ...(options.session ? { sessionId: options.session.sessionId } : {}) },
      body: options.form ? new URLSearchParams(options.form) : undefined,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(options.timeout ?? 10000),
    });
    if (response.status === 401 || response.status === 403) throw new AppError('LOGIN_EXPIRED', '学校登录已失效，请重新登录', 401);
    if (!response.ok) throw new AppError('SCHOOL_HTTP', '学校服务暂时不可用，请稍后重试');
    const raw = await response.text();
    let data: Obj;
    try { const parsed = JSON.parse(raw); data = obj(parsed); if (!Object.keys(data).length) throw new Error(); }
    catch { throw new AppError('SCHOOL_RESPONSE', '学校返回了无法识别的数据，请稍后重试'); }
    checkAuth(data); return data;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('SCHOOL_NETWORK', '连接学校超时或网络不可用，请重试', 504);
  }
}
export async function login(account: string, password: string): Promise<SchoolSession> {
  const data = await schoolRequest('user/login.action', { login: true, form: {
    phone: account.trim(), password, verificationType: '1', userLevel: '1',
    verificationUrl: 'http://iclass.ucas.edu.cn:88/ve/webservices/mobileCheck.shtml?method=mobileLogin&username=${0}&password=${1}&lx=${2}',
  } });
  if (str(data.STATUS) !== '0') throw new AppError('LOGIN_REJECTED', '账号或密码不正确，请检查后重试', 401);
  const result = obj(data.result);
  const session = { userId: str(result.id), sessionId: str(result.sessionId), studentNo: str(result.studentNo) };
  if (Object.values(session).some(v => !v)) throw new AppError('SCHOOL_RESPONSE', '学校未返回完整身份，请重新登录');
  return session;
}
export function parseCourses(value: unknown, day: string): Course[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const c = obj(item);
    return { id: str(c.id), uuid: str(c.uuid), name: str(c.courseName) || '未命名课程', teacher: str(c.teacherName), beginTime: str(c.classBeginTime), endTime: str(c.classEndTime), day: normalizeDay(day), signed: str(c.signStatus) === '1' };
  }).filter(c => c.id || c.uuid);
}
export function parseWeek(data: Obj, day: string): CourseResult {
  checkAuth(data);
  // The Android code rejects STATUS=0 here; this adapter consistently requires success.
  if (str(data.STATUS) !== '0' || !Array.isArray(data.result)) throw new AppError('SCHEDULE_REJECTED', '学校暂未返回可用课表，请稍后刷新');
  const weeklyCourses = data.result.flatMap(item => { const d = obj(item); return parseCourses(d.schedData, str(d.dateStr)); });
  return { courses: todaySorted(weeklyCourses, day), weeklyCourses, fromWeeklyFallback: true, date: day, updatedAt: Date.now() };
}
export async function getCourses(session: SchoolSession, day = shanghaiDay()): Promise<CourseResult> {
  const form = { id: session.userId, dateStr: day };
  const data = await schoolRequest('course/get_stu_course_sched.action', { session, form });
  const courses = parseCourses(data.result, day);
  if (str(data.STATUS) === '0' && courses.length) return { courses: todaySorted(courses, day), weeklyCourses: [], fromWeeklyFallback: false, date: day, updatedAt: Date.now() };
  return parseWeek(await schoolRequest('course/get_stu_course_sched_week.action', { session, form }), day);
}
export async function getClock() {
  const start = performance.now();
  const data = await schoolRequest('common/get_timestamp.do?id=0', { form: {}, timeout: 6000 });
  if (str(data.STATUS) !== '0' || typeof data.timestamp !== 'number' || !Number.isSafeInteger(data.timestamp) || data.timestamp < 1e12 || data.timestamp > 8.64e15) throw new AppError('CLOCK_INVALID', '学校校时数据异常，请重试');
  const rtt = performance.now() - start;
  return { timestamp: Math.round(data.timestamp + rtt / 2), upstreamRtt: Math.round(rtt), sampledAt: Date.now() };
}
export function parseSign(data: Obj): SignResult {
  checkAuth(data);
  const r = obj(data.result);
  const msg = [r.msg, data.ERRMSG, data.msg, data.message].map(str).find(Boolean) || '';
  if (/(二维码|签到码).*(失效|过期)|timestamp.*(invalid|expired)/i.test(msg)) return { outcome: 'expired', message: '签到码已过期，请重新校时后再试' };
  if (/已签到|重复签到/.test(msg)) return { outcome: 'already_signed', message: '学校提示已签到，正在核对课程状态' };
  if (str(data.STATUS) === '0' && ['', '0'].includes(str(data.ERRCODE)) && str(r.stuSignStatus) === '1' && (data.success === undefined || data.success === true)) return { outcome: 'signed', message: '签到成功，安心上课吧' };
  if (/未在上课时间|不在.*签到时间|不是上课时间|未选.*课|不属于.*课/.test(msg)) return { outcome: 'outside_window', message: '学校未接受签到，请确认课程及签到时间' };
  return { outcome: 'unknown', message: '学校未明确确认结果，请刷新课表核对后再试' };
}
export async function submitAttendance(session: SchoolSession, courseId: string) {
  const clock = await getClock();
  const query = new URLSearchParams({ courseSchedId: courseId, timestamp: String(clock.timestamp), id: session.userId });
  try { return parseSign(await schoolRequest(`course/stu_scan_sign.action?${query}`, { session, timeout: 10000 })); }
  catch (e) {
    if (e instanceof AppError && e.status === 401) throw e;
    // Never retry a potentially committed request. Reconcile through a read instead.
    try { const latest = await getCourses(session); if (latest.courses.some(c => c.id === courseId && c.signed)) return { outcome: 'signed', message: '已通过课表确认签到成功' } satisfies SignResult; }
    catch (verificationError) { if (verificationError instanceof AppError && verificationError.status === 401) throw verificationError; }
    return { outcome: 'unknown', message: '请求未收到完整结果，请刷新课表确认，暂勿重复签到' } satisfies SignResult;
  }
}
