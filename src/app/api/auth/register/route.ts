import type { NextRequest } from "next/server";
import { apiError, apiFailure, apiOk, readJson } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { issueCode } from "@/lib/auth/otp";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { sendMail, verificationEmail } from "@/lib/mailer";
import { OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { fieldErrors, registerSchema } from "@/lib/validators/auth";
import { generateUniquePublicId } from "@/lib/public-id";

export async function POST(request: NextRequest) {
  try {
    const ip = await clientIp();
    const limit = await consumeRateLimit(`register:${ip}`, 8, 60 * 60);
    if (!limit.allowed) {
      return apiError("عدد محاولات إنشاء الحسابات كبير، حاول لاحقاً", 429);
    }

    const body = await readJson<unknown>(request);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("يرجى تصحيح الحقول المميزة", 422, { fields: fieldErrors(parsed.error) });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (existing) {
      // An account exists. If it was never verified, let the customer continue
      // the verification flow instead of blocking them out of their own signup.
      if (!existing.emailVerifiedAt) {
        const code = await issueCode(email, "EMAIL_VERIFICATION");
        await sendMail({
          to: email,
          ...verificationEmail({
            code,
            purpose: "EMAIL_VERIFICATION",
            expiresInMinutes: OTP_TTL_MINUTES,
          }),
        });
        return apiOk({ email, needsVerification: true });
      }
      return apiError("يرجى تصحيح الحقول المميزة", 422, {
        fields: { email: "هذا البريد الإلكتروني مسجّل بالفعل" },
      });
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        publicId: await generateUniquePublicId(),
      },
    });

    const code = await issueCode(email, "EMAIL_VERIFICATION");
    await sendMail({
      to: email,
      ...verificationEmail({
        code,
        purpose: "EMAIL_VERIFICATION",
        expiresInMinutes: OTP_TTL_MINUTES,
      }),
    });

    return apiOk({ email, needsVerification: true });
  } catch (error) {
    return apiFailure("api/auth/register", error);
  }
}
