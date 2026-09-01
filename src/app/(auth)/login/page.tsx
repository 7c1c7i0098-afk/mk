import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "تسجيل الدخول" };

type PageProps = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, error } = await searchParams;
  const destination = safeRedirect(next);

  const user = await getCurrentUser();
  if (user) redirect(destination);

  return <LoginForm next={destination} initialError={error} />;
}
