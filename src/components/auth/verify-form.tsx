"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, SubmitButton } from "@/components/auth/fields";
import { OtpInput } from "@/components/auth/otp-input";

export function VerifyForm({ email, next }: { email: string; next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(value: string) {
    if (value.length !== 6 || loading) return;
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "رمز التحقق غير صحيح");
        setCode("");
        return;
      }

      window.location.assign(next);
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
        body: JSON.stringify({ email, purpose: "EMAIL_VERIFICATION" }),
      });
      const data = (await response.json()) as { error?: string; cooldown?: number };

      if (!response.ok) {
        setCooldown(data.cooldown ?? 60);
        toast.error(data.error ?? "تعذّر إرسال الرمز");
        return;
      }

      setCooldown(60);
      toast.success("تم إرسال رمز جديد إلى بريدك الإلكتروني");
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    }
  }

  return (
    <AuthCard
      title="تأكيد البريد الإلكتروني"
      description={`أدخل رمز التحقق المرسل إلى ${email}`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        className="space-y-5"
      >
        <FormError message={error} />

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(value) => void submit(value)}
          disabled={loading}
          invalid={Boolean(error)}
        />

        <SubmitButton loading={loading} disabled={code.length !== 6}>
          تأكيد
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
