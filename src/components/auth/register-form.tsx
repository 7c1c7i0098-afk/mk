"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { AuthDivider, SocialButtons } from "@/components/auth/social-buttons";

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      setFields((current) => ({ ...current, [key]: "" }));
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
        email?: string;
      };

      if (!response.ok) {
        setFields(data.fields ?? {});
        setError(data.fields ? null : (data.error ?? "تعذّر إنشاء الحساب"));
        return;
      }

      router.push(
        `/verify?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError("تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="إنشاء حساب"
      description="أنشئ حسابك للاستفادة من المحفظة وحفظ الطلبات والمفضلة"
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-brand hover:underline"
          >
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormError message={error} />

        <TextField
          label="الاسم"
          autoComplete="name"
          placeholder="اسمك الكامل"
          value={values.name}
          onChange={update("name")}
          error={fields.name}
          required
        />

        <TextField
          label="البريد الإلكتروني"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder="example@email.com"
          value={values.email}
          onChange={update("email")}
          error={fields.email}
          required
        />

        <PasswordField
          label="كلمة المرور"
          autoComplete="new-password"
          dir="ltr"
          placeholder="8 أحرف على الأقل مع رقم"
          value={values.password}
          onChange={update("password")}
          error={fields.password}
          required
        />

        <PasswordField
          label="تأكيد كلمة المرور"
          autoComplete="new-password"
          dir="ltr"
          placeholder="أعد كتابة كلمة المرور"
          value={values.confirmPassword}
          onChange={update("confirmPassword")}
          error={fields.confirmPassword}
          required
        />

        <SubmitButton loading={loading}>إنشاء الحساب</SubmitButton>
      </form>

      <AuthDivider />
      <SocialButtons next={next} />
    </AuthCard>
  );
}
