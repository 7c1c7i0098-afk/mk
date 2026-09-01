import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

const COOKIE_NAME = "pluscard_session";
/** "تذكرني" keeps the session for 30 days; otherwise it lasts for the browser session. */
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to at least 32 characters in production.");
    }
    return new TextEncoder().encode("pluscard-development-secret-key-0001");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { userId: string; role: Role; sessionVersion: number };

export async function createSession(
  userId: string,
  role: Role,
  options?: { remember?: boolean; sessionVersion?: number },
) {
  const remember = options?.remember ?? false;
  const maxAge = remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;

  const token = await new SignJWT({ role, v: options?.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Omitting maxAge makes it a browser-session cookie when "تذكرني" is off.
    ...(remember ? { maxAge } : {}),
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: (payload.role as Role) ?? "USER",
      sessionVersion: typeof payload.v === "number" ? payload.v : 0,
    };
  } catch {
    return null;
  }
}

/** Current user for the running request (memoized), or null when signed out. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      balance: true,
      discountBps: true,
      image: true,
      emailVerifiedAt: true,
      sessionVersion: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user || user.status === "SUSPENDED") return null;
  // A password reset bumps sessionVersion, which retires every older token.
  if (user.sessionVersion !== session.sessionVersion) return null;

  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: passwordHash !== null };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Requires a signed-in user; returns null for callers that redirect themselves. */
export async function requireUser() {
  return getCurrentUser();
}
