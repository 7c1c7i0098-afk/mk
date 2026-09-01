import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "تغيير كلمة المرور" };

type PageProps = { searchParams: Promise<{ email?: string; next?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { email, next } = await searchParams;
  if (!email) redirect("/forgot-password");

  return <ResetPasswordForm email={email} next={safeRedirect(next)} />;
}
