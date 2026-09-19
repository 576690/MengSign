import 'server-only';
import { cookies } from 'next/headers';
import { AppError } from './errors';
import { openSession, sealSession, SESSION_TTL } from './session-crypto';
import type { SchoolSession } from './types';
const secure = process.env.NODE_ENV === 'production';
export const cookieName = secure ? '__Host-mengsign' : 'mengsign-dev';
export async function requireSession() {
  const token = (await cookies()).get(cookieName)?.value;
  const session = token ? openSession(token) : null;
  if (!session) throw new AppError('LOGIN_EXPIRED', '登录已失效，请重新登录', 401);
  return session;
}
export async function saveSession(session: SchoolSession) {
  (await cookies()).set(cookieName, sealSession(session), { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: SESSION_TTL });
}
export async function clearSession() {
  (await cookies()).set(cookieName, '', { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 0 });
}
