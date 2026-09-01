"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, SubmitButton, TextField } from "@/components/auth/fields";

export function ForgotPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "تعذّر إرسال رمز التحقق");
        return;
      }

      // The response is identical whether or not the address exists.
      router.push(
        `/reset-password?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError("تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="استعادة كلمة المرور"
      description="أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور"
      footer={
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-brand hover:underline"
        >
          العودة لتسجيل الدخول
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        <TextField
          label="البريد الإلكتروني"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder="example@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <SubmitButton loading={loading}>إرسال رمز التحقق</SubmitButton>
      </form>
    </AuthCard>
  );
}
