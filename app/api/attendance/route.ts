import { body, checkOrigin, failure, json } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { profile } from "@/lib/session-crypto";
import { getCourses, submitAttendance } from "@/lib/school";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession(),
      input = await body(request);
    if (input.accountKey !== profile(session).accountKey)
      throw new AppError(
        "ACCOUNT_CHANGED",
        "账号已在其他窗口切换，请重新登录",
        401,
      );
    if (
      typeof input.courseId !== "string" ||
      !/^\d{1,20}$/.test(input.courseId)
    )
      throw new AppError("BAD_REQUEST", "课程 ID 无效", 400);
    const today = await getCourses(session),
      course = today.courses.find((c) => c.id === input.courseId);
    if (!course)
      throw new AppError(
        "COURSE_FORBIDDEN",
        "请从自己的今日课程中选择签到课程",
        403,
      );
    if (course.signed)
      return json({
        outcome: "already_signed",
        message: "课表已确认，这节课已经签到",
      });
    return json(await submitAttendance(session, course.id));
  } catch (e) {
    return failure(e);
  }
}
