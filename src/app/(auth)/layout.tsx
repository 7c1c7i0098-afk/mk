import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Focused shell for the authentication flow — dark, RTL, no storefront
 * navigation so the customer can finish signing in without distractions.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto w-full max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="العودة للمتجر"
          className="tap grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg hover:border-brand/40 hover:bg-surface-2"
        >
          <ArrowRight className="size-5" />
        </Link>
      </div>
      <div className="px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
