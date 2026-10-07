import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "job_auth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSigningKey() {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;

  if (!secret || Buffer.byteLength(secret) < 32 || !password) {
    throw new Error("Configure ADMIN_PASSWORD and a SESSION_SECRET of at least 32 bytes.");
  }

  // Rotating either credential invalidates previously issued sessions.
  return createHmac("sha256", secret)
    .update("job-aggregator:session:v1:")
    .update(password)
    .digest();
}

export function createSessionToken(now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const nonce = randomBytes(32).toString("base64url");
  const payload = `v1.${expiresAt}.${nonce}`;
  const signature = createHmac("sha256", getSigningKey())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 256) return false;

  const match = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;

  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }

  try {
    const payload = token.slice(0, token.lastIndexOf("."));
    const expected = createHmac("sha256", getSigningKey()).update(payload).digest();
    const supplied = Buffer.from(match[3], "base64url");

    return supplied.length === expected.length
      && supplied.toString("base64url") === match[3]
      && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
