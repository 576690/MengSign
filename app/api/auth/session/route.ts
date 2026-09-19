import { failure, json } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { profile } from '@/lib/session-crypto';
export const runtime = 'nodejs';
export async function GET() { try { return json({ profile: profile(await requireSession()) }); } catch (e) { return failure(e); } }
