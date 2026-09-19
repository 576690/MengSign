import { checkOrigin, failure, json } from "@/lib/http";
import { clearSession } from "@/lib/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await clearSession();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
