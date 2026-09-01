"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Image as ImageIcon,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "لوحة المعلومات", icon: LayoutDashboard, exact: true },
  { href: "/admin/categories", label: "الفئات", icon: Boxes },
  { href: "/admin/products", label: "المنتجات", icon: ShoppingBag },
  { href: "/admin/banners", label: "الإعلانات", icon: ImageIcon },
  { href: "/admin/suppliers", label: "المزوّدون", icon: Truck },
  { href: "/admin/orders", label: "الطلبات", icon: Receipt },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/support", label: "الدعم", icon: MessageCircle },
  { href: "/admin/wallet", label: "المحفظة", icon: Wallet, exact: true },
  { href: "/admin/transactions", label: "سجل العمليات", icon: Receipt },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="تنقل لوحة التحكم"
      className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:w-56 md:shrink-0 md:overflow-visible md:px-0"
    >
      <ul className="flex gap-2 md:flex-col">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line bg-surface text-muted hover:border-brand/30 hover:text-fg",
                )}
              >
                <Icon className="size-4.5" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
