import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/verify-form";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "تأكيد البريد الإلكتروني" };

type PageProps = { searchParams: Promise<{ email?: string; next?: string }> };

export default async function VerifyPage({ searchParams }: PageProps) {
  const { email, next } = await searchParams;
  if (!email) redirect("/login");

  return <VerifyForm email={email} next={safeRedirect(next)} />;
}
