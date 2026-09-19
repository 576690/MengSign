import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import type { SchoolSession, Profile } from "./types";
export const SESSION_TTL = 7 * 86400;
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.from(secret, "base64").length !== 32)
    throw new Error("SESSION_SECRET must encode 32 random bytes");
  return createHash("sha256").update(secret).digest();
}
export function sealSession(session: SchoolSession, now = Date.now()) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({ ...session, expires: now + SESSION_TTL * 1000 }),
      "utf8",
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function openSession(
  token: string,
  now = Date.now(),
): SchoolSession | null {
  try {
    const data = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    const parsed = JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      !Number.isFinite(parsed.expires) ||
      parsed.expires <= now ||
      !["userId", "sessionId", "studentNo"].every(
        (k) => typeof parsed[k] === "string" && parsed[k].length > 0,
      )
    )
      return null;
    return {
      userId: parsed.userId,
      sessionId: parsed.sessionId,
      studentNo: parsed.studentNo,
    };
  } catch {
    return null;
  }
}
export function profile(session: SchoolSession): Profile {
  return {
    accountKey: createHmac("sha256", key())
      .update(session.userId)
      .digest("hex")
      .slice(0, 24),
    label:
      session.studentNo.length > 4
        ? `•••• ${session.studentNo.slice(-4)}`
        : "学校账号",
  };
}
