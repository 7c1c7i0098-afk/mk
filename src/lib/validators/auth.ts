import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const email = z
  .string({ message: "البريد الإلكتروني مطلوب" })
  .trim()
  .min(1, "البريد الإلكتروني مطلوب")
  .max(255, "البريد الإلكتروني طويل جداً")
  .toLowerCase()
  .pipe(z.email({ message: "صيغة البريد الإلكتروني غير صحيحة" }));

const password = z
  .string({ message: "كلمة المرور مطلوبة" })
  .min(PASSWORD_MIN_LENGTH, `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`)
  .max(128, "كلمة المرور طويلة جداً")
  .refine((value) => /[A-Za-z؀-ۿ]/.test(value), "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل")
  .refine((value) => /\d/.test(value), "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل");

const code = z
  .string({ message: "رمز التحقق مطلوب" })
  .trim()
  .regex(/^\d{6}$/, "رمز التحقق يتكوّن من 6 أرقام");

export const registerSchema = z
  .object({
    name: z
      .string({ message: "الاسم مطلوب" })
      .trim()
      .min(2, "الاسم قصير جداً")
      .max(60, "الاسم طويل جداً"),
    email,
    password,
    confirmPassword: z.string({ message: "تأكيد كلمة المرور مطلوب" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string({ message: "كلمة المرور مطلوبة" }).min(1, "كلمة المرور مطلوبة"),
  remember: z.boolean().optional().default(false),
});

export const emailOnlySchema = z.object({ email });

export const verifyCodeSchema = z.object({ email, code });

export const resetPasswordSchema = z
  .object({
    email,
    code,
    password,
    confirmPassword: z.string({ message: "تأكيد كلمة المرور مطلوب" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export const cartItemsSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(200),
});

/** Flattens a Zod error into { field: message } for the Arabic forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result;
}
