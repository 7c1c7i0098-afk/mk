"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, PasswordField, SubmitButton } from "@/components/auth/fields";
import { OtpInput } from "@/components/auth/otp-input";

export function ResetPasswordForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, confirmPassword }),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        setFields(data.fields ?? {});
        setError(data.fields ? null : (data.error ?? "تعذّر تغيير كلمة المرور"));
        return;
      }

      toast.success("تم تغيير كلمة المرور، سجّل الدخول بكلمتك الجديدة");
      router.push(`/login?next=${encodeURIComponent(next)}`);
    } catch {
      setError("تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "PASSWORD_RESET" }),
      });
      const data = (await response.json()) as { error?: string; cooldown?: number };
      setCooldown(data.cooldown ?? 60);
      if (response.ok) toast.success("تم إرسال رمز جديد إذا كان البريد مسجّلاً لدينا");
      else toast.error(data.error ?? "تعذّر إرسال الرمز");
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    }
  }

  return (
    <AuthCard
      title="تغيير كلمة المرور"
      description={`أدخل رمز التحقق المرسل إلى ${email} ثم اختر كلمة مرور جديدة`}
      footer={
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-brand hover:underline"
        >
          العودة لتسجيل الدخول
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />

        <div className="space-y-2">
          <p className="text-center text-sm font-medium text-fg">أدخل رمز التحقق</p>
          <OtpInput value={code} onChange={setCode} disabled={loading} invalid={Boolean(error)} />
        </div>

        <PasswordField
          label="كلمة المرور الجديدة"
          autoComplete="new-password"
          dir="ltr"
          placeholder="8 أحرف على الأقل مع رقم"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fields.password}
          required
        />

        <PasswordField
          label="تأكيد كلمة المرور الجديدة"
          autoComplete="new-password"
          dir="ltr"
          placeholder="أعد كتابة كلمة المرور"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fields.confirmPassword}
          required
        />

        <SubmitButton loading={loading} disabled={code.length !== 6}>
          تغيير كلمة المرور
        </SubmitButton>
      </form>

      <button
        type="button"
        onClick={() => void resend()}
        disabled={cooldown > 0}
        className="w-full text-center text-sm font-medium text-brand transition hover:underline disabled:text-muted-2 disabled:no-underline"
      >
        {cooldown > 0 ? (
          <>
            إعادة إرسال الرمز بعد <span className="num">{cooldown}</span> ثانية
          </>
        ) : (
          "إعادة إرسال الرمز"
        )}
      </button>
    </AuthCard>
  );
}
