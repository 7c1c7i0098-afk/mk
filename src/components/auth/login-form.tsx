"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { AuthDivider, SocialButtons } from "@/components/auth/social-buttons";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = (await response.json()) as {
        error?: string;
        needsVerification?: boolean;
      };

      if (!response.ok) {
        setError(data.error ?? "تعذّر تسجيل الدخول");
        return;
      }

      if (data.needsVerification) {
        router.push(
          `/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
        );
        return;
      }

      // Full navigation so the server components pick up the new session.
      window.location.assign(next);
    } catch {
      setError("تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="تسجيل الدخول"
      description="أدخل بياناتك للمتابعة إلى حسابك في PLUS CARD"
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-semibold text-brand hover:underline"
          >
            إنشاء حساب
          </Link>
        </>
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

        <PasswordField
          label="كلمة المرور"
          autoComplete="current-password"
          dir="ltr"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 accent-[var(--color-brand)]"
            />
            تذكرني
          </label>

          <Link
            href={`/forgot-password?next=${encodeURIComponent(next)}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        <SubmitButton loading={loading}>تسجيل الدخول</SubmitButton>
      </form>

      <AuthDivider />
      <SocialButtons next={next} />
    </AuthCard>
  );
}
