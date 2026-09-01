import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "لوحة التحكم" };

/**
 * Admin shell. The guard runs here, so every nested page and layout is
 * unreachable for customers and guests regardless of the URL they type.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-dvh bg-ink">
      <header className="border-b border-line bg-ink-2">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <Link href="/admin" className="text-base font-bold text-fg">
            PLUS<span className="text-brand">CARD</span>
            <span className="ms-2 text-xs font-medium text-muted">لوحة التحكم</span>
          </Link>

          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">{admin.name}</span>
            <Link
              href="/"
              className="tap rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg hover:border-brand/40"
            >
              عرض المتجر
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
        <div className="flex flex-col gap-5 md:flex-row">
          <AdminNav />
          <main className="min-w-0 flex-1 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
