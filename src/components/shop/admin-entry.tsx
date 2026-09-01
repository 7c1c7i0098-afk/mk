import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

/** Shown on the account page for administrators only. */
export function AdminEntry() {
  return (
    <Link
      href="/admin"
      className="tap flex items-center gap-3 rounded-3xl border border-brand/40 bg-brand-soft px-4 py-4 transition hover:bg-brand/15"
    >
      <ShieldCheck className="size-5 text-brand" />
      <span className="flex-1 text-sm font-bold text-fg">لوحة التحكم</span>
      <ChevronLeft className="size-4 text-brand" />
    </Link>
  );
}
