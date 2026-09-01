import type { NextRequest } from "next/server";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { verifyCode } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyCodeSchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<unknown>(request);
    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) return apiError("رمز التحقق يتكوّن من 6 أرقام", 422);

    const { email, code } = parsed.data;
    const ip = await clientIp();

    const limit = await consumeRateLimit(`verify:${email}:${ip}`, 10, 15 * 60);
    if (!limit.allowed) {
      return apiError("تم تجاوز عدد المحاولات، اطلب رمزاً جديداً لاحقاً", 429);
    }

    const result = await verifyCode(email, "EMAIL_VERIFICATION", code);
    if (!result.ok) {
      if (result.reason === "expired") return apiError("انتهت صلاحية الرمز، اطلب رمزاً جديداً", 400);
      if (result.reason === "too_many_attempts") {
        return apiError("تم تجاوز عدد المحاولات لهذا الرمز، اطلب رمزاً جديداً", 429);
      }
      if (result.reason === "missing") return apiError("لا يوجد رمز فعّال، اطلب رمزاً جديداً", 400);
      return apiError("رمز التحقق غير صحيح", 400);
    }

    const user = await prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: new Date() },
    });

    if (user.status === "SUSPENDED") {
      return apiError("تم إيقاف هذا الحساب، يرجى التواصل مع الدعم", 403);
    }

    await createSession(user.id, user.role, {
      remember: true,
      sessionVersion: user.sessionVersion,
    });

    return apiOk();
  } catch (error) {
    return apiFailure("api/auth/verify-email", error);
  }
}
