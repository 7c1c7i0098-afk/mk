import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { OTP_TTL_MINUTES, issueCode, resendCooldownRemaining } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { sendMail, verificationEmail } from "@/lib/mailer";
import { emailOnlySchema } from "@/lib/validators/auth";

const schema = emailOnlySchema.extend({
  purpose: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"]).default("EMAIL_VERIFICATION"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<unknown>(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("صيغة البريد الإلكتروني غير صحيحة", 422);

    const { email, purpose } = parsed.data;
    const ip = await clientIp();

    const limit = await consumeRateLimit(`otp-send:${email}:${ip}`, 5, 60 * 60);
    if (!limit.allowed) {
      return apiError("تم إرسال عدد كبير من الرموز، حاول بعد ساعة", 429);
    }

    const cooldown = await resendCooldownRemaining(email, purpose);
    if (cooldown > 0) {
      return apiError(`يمكنك طلب رمز جديد بعد ${cooldown} ثانية`, 429, { cooldown });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, emailVerifiedAt: true },
    });

    // Password reset must not reveal whether the address exists.
    const shouldSend =
      purpose === "EMAIL_VERIFICATION"
        ? Boolean(user) && !user?.emailVerifiedAt
        : Boolean(user?.passwordHash);

    if (shouldSend) {
      const code = await issueCode(email, purpose);
      await sendMail({
        to: email,
        ...verificationEmail({ code, purpose, expiresInMinutes: OTP_TTL_MINUTES }),
      });
    }

    return apiOk({ cooldown: 60 });
  } catch (error) {
    return apiFailure("api/auth/resend-code", error);
  }
}
