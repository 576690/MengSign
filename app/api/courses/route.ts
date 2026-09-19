import { failure, json } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { getCourses } from "@/lib/school";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    return json(await getCourses(await requireSession()));
  } catch (e) {
    return failure(e);
  }
}
