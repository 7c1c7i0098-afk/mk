import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد الانتظار",
  PROCESSING: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  REFUNDED: "مسترجع",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-fg">الطلبات</h1>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا توجد طلبات بعد — تُنشأ الطلبات بعد تفعيل الدفع من المحفظة
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="num truncate text-sm font-semibold text-fg">{order.orderNumber}</p>
                <p className="truncate text-xs text-muted">{order.user.name}</p>
                <p className="num text-[11px] text-muted-2">{order._count.items} عنصر</p>
              </div>
              <span className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
              <span className="num text-sm font-bold text-brand">{formatMoney(order.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
