import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "vera_anon";

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
