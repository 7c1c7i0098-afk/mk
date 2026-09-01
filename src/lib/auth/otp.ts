import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import type { VerificationPurpose } from "@/generated/prisma/enums";

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

function otpSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to at least 32 characters in production.");
    }
    return "pluscard-development-secret-key-0001";
  }
  return secret;
}

/** Codes are stored as an HMAC — the plaintext never touches the database. */
function hashCode(code: string, email: string, purpose: VerificationPurpose) {
  return createHmac("sha256", otpSecret())
    .update(`${purpose}:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

/** Cryptographically secure 6-digit code. */
function generateCode() {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

/** Seconds the caller must wait before a new code may be requested. */
export async function resendCooldownRemaining(
  email: string,
  purpose: VerificationPurpose,
): Promise<number> {
  const latest = await prisma.verificationCode.findFirst({
    where: { email: email.toLowerCase(), purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return 0;

  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
  return elapsed >= OTP_RESEND_COOLDOWN_SECONDS
    ? 0
    : Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
}

/**
 * Issues a fresh code and invalidates any outstanding one for the same purpose,
 * so only the newest code can ever be redeemed.
 */
export async function issueCode(email: string, purpose: VerificationPurpose) {
  const normalized = email.toLowerCase();
  const code = generateCode();

  await prisma.$transaction([
    prisma.verificationCode.updateMany({
      where: { email: normalized, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.verificationCode.create({
      data: {
        email: normalized,
        purpose,
        codeHash: hashCode(code, normalized, purpose),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  return code;
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Validates a code server-side and consumes it on success. Attempts are counted
 * so a code cannot be brute-forced, and a consumed code can never be replayed.
 */
export async function verifyCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<VerifyCodeResult> {
  const normalized = email.toLowerCase();

  const record = await prisma.verificationCode.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "missing" };
  if (record.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(record.codeHash, "hex");
  const provided = Buffer.from(hashCode(code, normalized, purpose), "hex");
  const matches =
    expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!matches) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "mismatch" };
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}
