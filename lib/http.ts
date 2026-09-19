import { NextResponse } from "next/server";
import { AppError } from "./errors";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}
export function failure(error: unknown) {
  return error instanceof AppError
    ? json(
        { error: { code: error.code, message: error.message } },
        error.status,
      )
    : json(
        { error: { code: "INTERNAL", message: "服务暂时不可用，请稍后重试" } },
        500,
      );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set(
    [
      process.env.APP_ORIGIN,
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    ].filter(Boolean),
  );
  for (const extra of (process.env.ADDITIONAL_ORIGINS || "").split(",")) {
    if (extra.trim()) allowed.add(extra.trim());
  }
  if (process.env.NODE_ENV !== "production")
    allowed.add(new URL(request.url).origin);
  if (
    !origin ||
    !allowed.has(origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError("FORBIDDEN", "请从 MengSign 页面发起操作", 403);
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("BAD_REQUEST", "请求格式不正确", 400);
  // Limit while streaming, not after buffering an untrusted body.
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("BAD_REQUEST", "请求内容为空", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new AppError("BAD_REQUEST", "请求内容过大", 413);
    }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AppError("BAD_REQUEST", "请求格式不正确", 400);
  }
}
