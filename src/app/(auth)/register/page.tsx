import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "إنشاء حساب" };

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const destination = safeRedirect(next);

  const user = await getCurrentUser();
  if (user) redirect(destination);

  return <RegisterForm next={destination} />;
}
