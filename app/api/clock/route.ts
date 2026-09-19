import { failure, json } from '@/lib/http';
import { getClock } from '@/lib/school';
export const runtime = 'nodejs';
export async function GET() { try { return json(await getClock()); } catch (e) { return failure(e); } }
