import { createRemoteJWKSet, jwtVerify } from "jose";

let verificationKeys: ReturnType<typeof createRemoteJWKSet> | null = null;
let verificationAppId: string | null = null;

function getVerificationKeys(appId: string) {
  if (!verificationKeys || verificationAppId !== appId) {
    verificationKeys = createRemoteJWKSet(
      new URL(`https://api.privy.io/v1/apps/${encodeURIComponent(appId)}/jwks.json`),
    );
    verificationAppId = appId;
  }
  return verificationKeys;
}

/**
 * Verifies the Privy access-token signature and its issuer/audience/expiry.
 * Never trust a client-supplied user ID.
 */
export async function verifyPrivyAccessToken(token: string): Promise<string | null> {
  const appId = process.env.PRIVY_APP_ID;
  if (!appId || !token) return null;

  try {
    const { payload } = await jwtVerify(token, getVerificationKeys(appId), {
      algorithms: ["ES256"],
      issuer: "privy.io",
      audience: appId,
    });
    const subject = payload.sub;
    return typeof subject === "string" && subject.startsWith("did:privy:")
      ? subject
      : null;
  } catch {
    return null;
  }
}

export function privyServerConfigured() {
  return Boolean(process.env.PRIVY_APP_ID);
}
