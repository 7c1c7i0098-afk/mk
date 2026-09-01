import type { NextRequest } from "next/server";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { verifyCode } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/session";
import { fieldErrors, resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<unknown>(request);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("يرجى تصحيح الحقول المميزة", 422, { fields: fieldErrors(parsed.error) });
    }

    const { email, code, password } = parsed.data;
    const ip = await clientIp();

    const limit = await consumeRateLimit(`reset:${email}:${ip}`, 10, 15 * 60);
    if (!limit.allowed) return apiError("تم تجاوز عدد المحاولات، حاول لاحقاً", 429);

    const result = await verifyCode(email, "PASSWORD_RESET", code);
    if (!result.ok) {
      if (result.reason === "expired") return apiError("انتهت صلاحية الرمز، اطلب رمزاً جديداً", 400);
      if (result.reason === "too_many_attempts") {
        return apiError("تم تجاوز عدد المحاولات لهذا الرمز، اطلب رمزاً جديداً", 429);
      }
      if (result.reason === "missing") return apiError("لا يوجد رمز فعّال، اطلب رمزاً جديداً", 400);
      return apiError("رمز التحقق غير صحيح", 400);
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return apiError("رمز التحقق غير صحيح", 400);

    // Bumping sessionVersion signs every existing device out.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });

    await destroySession();

    return apiOk();
  } catch (error) {
    return apiFailure("api/auth/reset-password", error);
  }
}
