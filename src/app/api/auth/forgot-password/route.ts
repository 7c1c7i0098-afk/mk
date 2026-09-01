import type { NextRequest } from "next/server";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { OTP_TTL_MINUTES, issueCode, resendCooldownRemaining } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { sendMail, verificationEmail } from "@/lib/mailer";
import { emailOnlySchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<unknown>(request);
    const parsed = emailOnlySchema.safeParse(body);
    if (!parsed.success) return apiError("صيغة البريد الإلكتروني غير صحيحة", 422);

    const { email } = parsed.data;
    const ip = await clientIp();

    const limit = await consumeRateLimit(`forgot:${email}:${ip}`, 5, 60 * 60);
    // Always answer the same way — the response must not reveal whether the
    // address belongs to an account.
    if (!limit.allowed) return apiOk({ cooldown: 60 });

    const cooldown = await resendCooldownRemaining(email, "PASSWORD_RESET");
    if (cooldown === 0) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true },
      });

      if (user?.passwordHash) {
        const code = await issueCode(email, "PASSWORD_RESET");
        await sendMail({
          to: email,
          ...verificationEmail({
            code,
            purpose: "PASSWORD_RESET",
            expiresInMinutes: OTP_TTL_MINUTES,
          }),
        });
      }
    }

    return apiOk({ cooldown: 60 });
  } catch (error) {
    return apiFailure("api/auth/forgot-password", error);
  }
}
