import type { NextRequest } from "next/server";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { OTP_TTL_MINUTES, issueCode } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { sendMail, verificationEmail } from "@/lib/mailer";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators/auth";

/** Same message for unknown email and wrong password — no account enumeration. */
const INVALID_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<unknown>(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return apiError(INVALID_CREDENTIALS, 422);

    const { email, password, remember } = parsed.data;
    const ip = await clientIp();
    const limitKey = `login:${email}:${ip}`;

    const limit = await consumeRateLimit(limitKey, 8, 15 * 60);
    if (!limit.allowed) {
      return apiError(
        `تم تجاوز عدد المحاولات المسموح بها، حاول بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة`,
        429,
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-ish work whether or not the account exists.
    const passwordMatches = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) return apiError(INVALID_CREDENTIALS, 401);

    if (user.status === "SUSPENDED") {
      return apiError("تم إيقاف هذا الحساب، يرجى التواصل مع الدعم", 403);
    }

    if (!user.emailVerifiedAt) {
      const code = await issueCode(email, "EMAIL_VERIFICATION");
      await sendMail({
        to: email,
        ...verificationEmail({
          code,
          purpose: "EMAIL_VERIFICATION",
          expiresInMinutes: OTP_TTL_MINUTES,
        }),
      });
      return apiOk({ needsVerification: true, email });
    }

    await resetRateLimit(limitKey);
    await createSession(user.id, user.role, {
      remember,
      sessionVersion: user.sessionVersion,
    });

    return apiOk({ needsVerification: false });
  } catch (error) {
    return apiFailure("api/auth/login", error);
  }
}
