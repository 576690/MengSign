import type { CourseResult } from './types';
export class ClientError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(url: string, input?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { method: input === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }), signal: AbortSignal.timeout(55000) }); }
  catch { throw new ClientError('网络连接中断，请检查网络后重试', 0); }
  let data;
  try { data = await response.json(); } catch { throw new ClientError('服务暂时不可用，请稍后重试', response.status); }
  if (!response.ok) throw new ClientError(data.error?.message || '请求失败，请重试', response.status);
  return data as T;
}
export function readCache(account: string, day: string): CourseResult | null {
  try { const value = JSON.parse(localStorage.getItem(`mengsign:courses:${account}:${day}`) || 'null'); return value?.date === day && Array.isArray(value.courses) && typeof value.updatedAt === 'number' ? value : null; } catch { return null; }
}
export function writeCache(account: string, result: CourseResult) { try { clearCourses(); localStorage.setItem(`mengsign:courses:${account}:${result.date}`, JSON.stringify(result)); } catch { /* Private mode or storage full: the live app still works. */ } }
export function clearCourses() { try { Object.keys(localStorage).filter(k => k.startsWith('mengsign:courses:')).forEach(k => localStorage.removeItem(k)); } catch {} }
export function clearPersonal() { clearCourses(); try { localStorage.removeItem('mengsign:profile'); } catch {} }
export function demoCourses(): CourseResult {
  // The sample day has a stable, explicitly labelled display clock, independent of real attendance.
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format().replaceAll('-', '');
  return { date, updatedAt: Date.now(), fromWeeklyFallback: false, weeklyCourses: [], courses: [
    { id: '1000001', uuid: '', name: '高等矩阵分析', teacher: '示例教师', beginTime: '08:30', endTime: '10:10', day: date, signed: true },
    { id: '1000002', uuid: '', name: '学术英语', teacher: '示例教师', beginTime: '10:30', endTime: '12:10', day: date, signed: false },
    { id: '1000003', uuid: '', name: '中国马克思主义与当代', teacher: '示例教师', beginTime: '13:30', endTime: '15:10', day: date, signed: false },
    { id: '1000004', uuid: '', name: '科学研究方法', teacher: '示例教师', beginTime: '15:30', endTime: '17:10', day: date, signed: false },
  ] };
}
