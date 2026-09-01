"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, ShoppingCart, User, Wallet } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/wallet", label: "المحفظة", icon: Wallet },
  { href: "/cart", label: "السلة", icon: ShoppingCart },
  { href: "/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/account", label: "حسابي", icon: User },
] as const;

/** Fixed mobile navigation. Search lives in the header, never here. */
/**
 * Screens that own the whole display. The support chat is one: its composer
 * belongs at the very bottom, and a row of tabs under it would be both a
 * distraction mid-message and a strip of dead space above the keyboard.
 */
const FULL_SCREEN_ROUTES = ["/support"];

export function BottomNav() {
  const pathname = usePathname();
  const { totalQuantity: cartCount } = useCart();

  if (FULL_SCREEN_ROUTES.includes(pathname)) return null;

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="pc-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-ink-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex w-full max-w-5xl items-stretch">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap relative flex h-16 flex-col items-center justify-center gap-1",
                  active ? "text-brand" : "text-muted hover:text-fg",
                )}
              >
                {/* Glass pill behind the selected tab only — a brand-tinted
                    wash with a hairline edge, so it reads as glass in both
                    themes without competing with the icon. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-2 inset-y-1.5 rounded-2xl transition-opacity duration-200 ease-[var(--ease-smooth)] motion-reduce:transition-none",
                    active
                      ? "bg-brand/12 opacity-100 ring-1 ring-brand/25"
                      : "opacity-0",
                  )}
                />

                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                  {item.href === "/cart" && cartCount > 0 && (
                    <span className="num absolute -end-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </span>
                <span className="relative text-[11px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
