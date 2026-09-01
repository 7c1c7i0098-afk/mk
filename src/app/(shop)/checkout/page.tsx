import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/shop/back-button";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { buildCheckoutPreview } from "@/lib/orders/checkout";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "الدفع" };

/**
 * Checkout.
 *
 * The basket is read from the database rather than from the browser, so the
 * prices shown here are the prices charged — a stale tab cannot buy yesterday's
 * price, and a tampered payload has nothing to tamper with.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const preview = await buildCheckoutPreview(user.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/cart" />
        <h1 className="pb-0.5 text-lg font-bold leading-[1.6] text-fg">الدفع</h1>
      </div>

      <CheckoutSteps />

      {preview.lines.length === 0 ? (
        <div className="space-y-4 rounded-3xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-sm text-muted">سلتك فارغة</p>
          <Link
            href="/"
            className="tap inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            تصفّح المنتجات
          </Link>
        </div>
      ) : (
        <CheckoutForm preview={preview} />
      )}
    </div>
  );
}

/**
 * Where the customer is in the purchase. Static by design: this screen is only
 * ever reached at the middle step, and the rails are decoration, not links —
 * going back is the arrow's job.
 */
function CheckoutSteps() {
  return (
    <ol className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
      <Step label="السلة" state="done" />
      <Rail lit />
      <Step label="الدفع" state="current" />
      <Rail />
      <Step label="تأكيد" state="todo" />
    </ol>
  );
}

function Step({ label, state }: { label: string; state: "done" | "current" | "todo" }) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 pb-2 text-xs font-bold leading-[1.5]",
        state === "todo" ? "bg-surface-2 text-muted-2" : "bg-brand text-white",
      )}
    >
      {label}
    </li>
  );
}

function Rail({ lit = false }: { lit?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("h-0.5 flex-1 rounded-full", lit ? "bg-brand/60" : "bg-line")}
    />
  );
}
