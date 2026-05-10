import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "grouptrip_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error("SESSION_SECRET (or APP_PASSWORD) must be set");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function createSession(): Promise<void> {
  const secret = getSecret();
  const issuedAt = Date.now().toString();
  const sig = sign(issuedAt, secret);
  const value = `${issuedAt}.${sig}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie) return false;
  const parts = cookie.value.split(".");
  if (parts.length !== 2) return false;
  const [issuedAt, sig] = parts;
  const expected = sign(issuedAt, secret);
  if (!timingSafeEqualHex(expected, sig)) return false;
  const ts = Number(issuedAt);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = (Date.now() - ts) / 1000;
  if (ageSeconds > MAX_AGE_SECONDS) return false;
  return true;
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export function verifyPasswordMatch(input: string): boolean {
  const expected = process.env.APP_PASSWORD || "friends123";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
