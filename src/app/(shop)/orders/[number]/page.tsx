import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/shop/back-button";
import { CopyButton } from "@/components/shop/copy-button";
import { Thumb } from "@/components/ui/thumb";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type PageProps = { params: Promise<{ number: string }> };

export const metadata: Metadata = { title: "تفاصيل الطلب" };

/**
 * One order, and the goods it delivered.
 *
 * The delivered code is the most sensitive thing PLUS CARD stores. The lookup
 * below matches on the order number AND the session's user id, so the number in
 * the URL is not a key to anything: guessing somebody else's number returns a
 * 404, not their card.
 */
export default async function OrderDetailsPage({ params }: PageProps) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${number}`)}`);

  // The URL carries the customer-facing number, the same one printed on the
  // wallet entry for this purchase — there is nothing else for them to quote.
  const sequence = Number(number);
  if (!Number.isInteger(sequence) || sequence <= 0) notFound();

  const order = await prisma.order.findFirst({
    where: { number: sequence, userId: user.id },
    select: {
      number: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          variantName: true,
          productImage: true,
          deliveredCode: true,
          deliveredSerial: true,
          deliveredExpiry: true,
          // Only whether it is still being fulfilled — never the supplier's name.
          supplierOrder: { select: { status: true } },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/orders" />
        <h1 className="text-glow flex-1 pb-0.5 text-center text-lg font-bold leading-[1.6] text-fg-strong">
          تفاصيل الطلب
        </h1>
        <span className="size-6 shrink-0" aria-hidden />
      </div>

      <div className="space-y-0.5 border-b border-line pb-4">
        <p className="text-lg font-bold leading-[1.7] text-fg">
          الطلب #<span className="num">{order.number}</span>
        </p>
        <p className="text-sm text-muted">
          تاريخ الطلب: <span className="tnum">{formatDateTime(order.createdAt)}</span>
        </p>
      </div>

      <ul className="space-y-3">
        {order.items.map((item) => {
          const status = item.supplierOrder?.status;
          const failed =
            status === "REFUNDED" || status === "NEEDS_REVIEW" || status === "FAILED";

          return (
            <li
              key={item.id}
              className="space-y-3 rounded-2xl border border-line bg-ink p-4"
            >
              <div className="flex items-center gap-3">
                <Thumb
                  src={item.productImage}
                  alt={item.variantName}
                  sizes="56px"
                  rounded="rounded-full"
                  className="size-14 shrink-0"
                />
                <p className="min-w-0 flex-1 truncate pb-0.5 text-sm font-bold leading-[1.7] text-fg">
                  {item.variantName}
                </p>
                {item.deliveredCode && (
                  <CopyButton value={item.deliveredCode} label="نسخ رقم البطاقة" />
                )}
              </div>

              {item.deliveredCode ? (
                <dl className="space-y-2 text-sm">
                  <Field label="رقم البطاقة" value={item.deliveredCode} />
                  {item.deliveredSerial && (
                    <Field label="الرقم التسلسلي" value={item.deliveredSerial} />
                  )}
                  {item.deliveredExpiry && (
                    <Field label="تاريخ الانتهاء" value={item.deliveredExpiry} />
                  )}
                </dl>
              ) : failed ? (
                <p className="rounded-xl border border-line bg-ink px-3 py-2 text-xs text-muted">
                  تعذّر تنفيذ هذا المنتج وأُعيد مبلغه إلى محفظتك
                </p>
              ) : (
                <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  قيد التنفيذ — سيظهر الكود هنا فور اكتماله
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Label on the right, value on the left, the value itself always read LTR. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd dir="ltr" className="num min-w-0 truncate font-semibold text-fg">
        {value}
      </dd>
    </div>
  );
}
