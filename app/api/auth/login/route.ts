import { body, checkOrigin, failure, json } from '@/lib/http';
import { AppError } from '@/lib/errors';
import { login } from '@/lib/school';
import { saveSession } from '@/lib/session';
import { profile } from '@/lib/session-crypto';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request); const input = await body(request);
    if (typeof input.account !== 'string' || !input.account.trim() || input.account.length > 160 || typeof input.password !== 'string' || !input.password || input.password.length > 80) throw new AppError('BAD_REQUEST', '请输入有效的账号和密码', 400);
    const session = await login(input.account, input.password); await saveSession(session);
    return json({ profile: profile(session) });
  } catch (e) { return failure(e); }
}
