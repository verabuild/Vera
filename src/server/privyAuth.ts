import { PrivyClient } from "@privy-io/node";

let client: PrivyClient | null = null;

function getClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  client ||= new PrivyClient({ appId, appSecret });
  return client;
}

/** Verifies the bearer token with Privy's server SDK. Never trust client-supplied user IDs. */
export async function verifyPrivyAccessToken(token: string): Promise<string | null> {
  const privy = getClient();
  if (!privy || !token) return null;
  const claims = await privy.verifyAuthToken(token) as { userId?: string; sub?: string };
  const subject = claims.userId ?? claims.sub;
  return typeof subject === "string" && subject.startsWith("did:privy:") ? subject : null;
}

export function privyServerConfigured() {
  return Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}
