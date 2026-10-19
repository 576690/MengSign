import { failure, json } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { profile } from "@/lib/session-crypto";
import { getTimetable } from "@/lib/school";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const session = await requireSession();
    return json({
      ...(await getTimetable(session)),
      accountKey: profile(session).accountKey,
    });
  } catch (e) {
    return failure(e);
  }
}
