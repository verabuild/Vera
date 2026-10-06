import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "vera_anon";
const QUOTA_COOKIE_NAME = "vera_quota";

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function getAnonymousSubject(req: VercelRequest, res: VercelResponse): string | null {
  const secret = process.env.VERA_ANON_SECRET;
  if (!secret || secret.length < 32) return null;

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = (Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader)
    .split(";")
    .map((part) => part.trim());
  const existing = cookies.find((part) => part.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);

  if (existing) {
    const separator = existing.lastIndexOf(".");
    if (separator > 0) {
      const id = existing.slice(0, separator);
      const signature = existing.slice(separator + 1);
      const expected = sign(id, secret);
      const actualBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)) {
        return createHash("sha256").update(id).digest("hex");
      }
    }
  }

  const id = randomBytes(32).toString("hex");
  const value = id + "." + sign(id, secret);
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  return createHash("sha256").update(id).digest("hex");
}


function parseCookies(req: VercelRequest) {
  const cookieHeader = req.headers.cookie ?? "";
  return (Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function encodePayload(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function setCookie(res: VercelResponse, name: string, value: string, maxAge: number) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

export function consumeFallbackQuota(
  req: VercelRequest,
  res: VercelResponse,
  subjectId: string,
  periodKey: string,
  limit: number
) {
  const secret = process.env.VERA_ANON_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Fallback quota protection is not configured");
  }

  const subjectHash = createHash("sha256").update(subjectId).digest("hex");
  const cookies = parseCookies(req);
  const raw = cookies.find((part) => part.startsWith(QUOTA_COOKIE_NAME + "="))?.slice(QUOTA_COOKIE_NAME.length + 1);

  let count = 0;
  if (raw) {
    const separator = raw.lastIndexOf(".");
    if (separator > 0) {
      const payloadEncoded = raw.slice(0, separator);
      const signature = raw.slice(separator + 1);
      const expected = sign(payloadEncoded, secret);
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        const payload = decodePayload(payloadEncoded);
        if (
          payload?.subjectHash === subjectHash &&
          payload?.periodKey === periodKey &&
          Number.isInteger(payload?.count) &&
          Number(payload.count) >= 0
        ) {
          count = Number(payload.count);
        }
      }
    }
  }

  if (count >= limit) {
    return { allowed: false, remaining: 0, degraded: true };
  }

  const nextCount = count + 1;
  const payload = encodePayload({
    subjectHash,
    periodKey,
    count: nextCount,
    updatedAt: Date.now()
  });
  const value = `${payload}.${sign(payload, secret)}`;
  const maxAge = periodKey === "lifetime"
    ? 31536000
    : Math.max(60, Math.ceil((Date.parse(periodKey + "T23:59:59.999Z") - Date.now()) / 1000));

  setCookie(res, QUOTA_COOKIE_NAME, value, maxAge);
  return { allowed: true, remaining: Math.max(0, limit - nextCount), degraded: true };
}
