import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "استعادة كلمة المرور" };

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  return <ForgotPasswordForm next={safeRedirect(next)} />;
}
