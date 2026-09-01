import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AccountScreen } from "@/components/shop/account-screen";
import { AccountId } from "@/components/shop/account-id";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "المعلومات الشخصية" };

/** Read-only for now: everything here is either set at sign-up or changed
 *  through its own flow, and a form that silently does nothing is worse than
 *  no form. */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/profile");

  const isPlaceholderEmail = user.email.endsWith("@users.pluscard.local");

  const rows = [
    { label: "الاسم", value: user.name, ltr: false },
    ...(isPlaceholderEmail ? [] : [{ label: "البريد الإلكتروني", value: user.email, ltr: true }]),
    ...(user.phone ? [{ label: "رقم الهاتف", value: user.phone, ltr: true }] : []),
  ];

  return (
    <AccountScreen title="المعلومات الشخصية">
      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-3.5">
              <dt className="shrink-0 text-sm text-muted">{row.label}</dt>
              <dd
                dir={row.ltr ? "ltr" : undefined}
                className="min-w-0 truncate text-sm font-semibold text-fg"
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {user.publicId && <AccountId publicId={user.publicId} />}

      <Link
        href="/forgot-password?next=/account/profile"
        className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4 transition hover:border-brand/40"
      >
        <KeyRound className="size-5 text-muted" aria-hidden />
        <span className="flex-1 text-sm font-medium text-fg">تغيير كلمة المرور</span>
      </Link>

      <p className="px-1 text-xs leading-relaxed text-muted-2">
        لتعديل اسمك أو بريدك راسلنا من صفحة المساعدة.
      </p>
    </AccountScreen>
  );
}
