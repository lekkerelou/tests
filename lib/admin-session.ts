const COOKIE_NAME = "claude_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }

  return secret;
}

async function encryptionKey() {
  const material = new TextEncoder().encode(sessionSecret());
  const digest = await crypto.subtle.digest("SHA-256", material);

  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function assertSessionConfigured() {
  sessionSecret();
}

export async function encryptAdminKey(adminKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(adminKey),
    ),
  );
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv);
  payload.set(encrypted, iv.length);

  return Buffer.from(payload).toString("base64url");
}

export async function decryptAdminKey(value: string) {
  try {
    const payload = new Uint8Array(Buffer.from(value, "base64url"));
    if (payload.length < 29) return null;

    const iv = payload.slice(0, 12);
    const encrypted = payload.slice(12);
    const key = await encryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export function readAdminSession(request: Request) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }

  return null;
}

export function sessionCookie(value: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${MAX_AGE_SECONDS}`,
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const expectedHost = forwardedHost ?? request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto");

    if (!expectedHost || originUrl.host !== expectedHost) return false;
    if (forwardedProtocol && originUrl.protocol !== `${forwardedProtocol}:`) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
