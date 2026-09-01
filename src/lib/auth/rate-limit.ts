import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the database, so limits survive restarts
 * and hold across server instances.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.expiresAt <= now) {
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSeconds: 0,
  };
}

/** Clears a counter after a successful attempt (e.g. a correct login). */
export async function resetRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Best-effort client IP for rate-limit keys. */
export async function clientIp() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}
