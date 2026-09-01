import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { MoneyText } from "@/components/shop/money-text";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { OrderStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "سجل الطلبات" };

/**
 * The customer's orders, one line each.
 *
 * Deliberately a summary: the delivered codes are the most sensitive thing
 * PLUS CARD stores, and they are not selected here at all. They live on the
 * order's own screen, one tap away, which keeps them off a list that is
 * scrolled past in public.
 *
 * The query is scoped by `userId` from the session — not by an id in the URL.
 */

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "بانتظار التنفيذ",
  PROCESSING: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  REFUNDED: "مسترجع",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "border-line bg-surface-2 text-muted",
  PROCESSING: "border-warn/40 bg-warn/10 text-warn",
  COMPLETED: "border-success/40 bg-success/10 text-success",
  CANCELLED: "border-danger/40 bg-danger/10 text-danger",
  REFUNDED: "border-line bg-surface-2 text-muted",
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      number: true,
      total: true,
      status: true,
      createdAt: true,
      items: { select: { quantity: true } },
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-glow pb-0.5 text-center text-lg font-bold leading-[1.6] text-fg-strong">
        سجل الطلبات
      </h1>

      {orders.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface px-6 py-14 text-center text-sm text-muted">
          لا توجد طلبات بعد
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
                <li key={order.id}>
                  {/* The whole row is the link — a small chevron would be a worse
                      tap target than the card it sits on. */}
                  <Link
                    href={`/orders/${order.number}`}
                    className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand/40"
                  >
                    <span
                      aria-hidden
                      className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg"
                    >
                      <ShoppingBag className="size-5" strokeWidth={1.9} />
                    </span>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate pb-0.5 text-sm font-bold leading-[1.7] text-fg">
                          الطلب #<span className="num">{order.number}</span>
                        </p>
                        <span className="num shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                          x{pieces}
                        </span>
                      </div>
                      <p className="tnum truncate text-xs text-muted-2">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[order.status]}`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                      <MoneyText value={order.total} className="text-sm font-bold text-fg" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
  );
}
