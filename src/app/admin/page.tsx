import Link from "next/link";
import { Boxes, Receipt, ShoppingBag, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد الانتظار",
  PROCESSING: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  REFUNDED: "مسترجع",
};

export default async function AdminDashboardPage() {
  const [products, categories, users, orders, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const cards = [
    { label: "المنتجات", value: products, icon: ShoppingBag, href: "/admin/products" },
    { label: "الفئات", value: categories, icon: Boxes, href: "/admin/categories" },
    { label: "المستخدمون", value: users, icon: Users, href: "/admin/users" },
    { label: "الطلبات", value: orders, icon: Receipt, href: "/admin/orders" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-fg">لوحة المعلومات</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="tap rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40"
            >
              <Icon className="size-5 text-brand" />
              <p className="num mt-3 text-2xl font-bold text-fg">{card.value}</p>
              <p className="text-xs text-muted">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-fg">أحدث الطلبات</h2>

        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">لا توجد طلبات بعد</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentOrders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="num truncate text-sm font-semibold text-fg">{order.orderNumber}</p>
                  <p className="truncate text-xs text-muted">{order.user.name}</p>
                </div>
                <span className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted">
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
                <span className="num text-sm font-bold text-brand">
                  {formatMoney(order.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
