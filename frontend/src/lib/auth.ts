import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { serverEnv } from "./env";

/**
 * Session = a short-lived JWT in an HTTP-only cookie.
 *
 * Why JWT and not opaque DB sessions? We don't need revocation today and a
 * 7-day signed token lets the server stay stateless. When we add admin
 * features we'll graduate to opaque tokens backed by a Session table.
 */

const COOKIE_NAME = "stakeport_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(serverEnv.jwtSecret);

export interface SessionPayload {
  sub: string; // User.id
  addr: string; // lowercase wallet address — convenient for client-side guard checks
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ addr: payload.addr })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.addr !== "string") return null;
    return { sub: payload.sub, addr: payload.addr };
  } catch {
    // Expired, tampered, or signed with a different secret. Treat as anon.
    return null;
  }
}

/** Set the session cookie on the current response. */
export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

/** Pull and verify the session from the incoming request's cookies. */
export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
