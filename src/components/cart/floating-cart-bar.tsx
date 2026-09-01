"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { MoneyText } from "@/components/shop/money-text";
import { cn } from "@/lib/utils";

/**
 * Sticky cart summary. Sits above the bottom navigation, follows the user
 * across the storefront and disappears when the cart is empty.
 */
export function FloatingCartBar() {
  const { totalQuantity, totalPrice, hydrated } = useCart();
  const pathname = usePathname();

  // The variant details screen carries its own purchase bar in the same spot.
  const onDetailsScreen = /^\/product\/[^/]+\/[^/]+$/.test(pathname);
  const onPurchaseScreen =
    pathname === "/cart" || pathname === "/checkout" || pathname === "/support";
  const visible = hydrated && totalQuantity > 0 && !onPurchaseScreen && !onDetailsScreen;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-4 pb-2.5"
      aria-hidden={!visible}
    >
      <Link
        href="/cart"
        tabIndex={visible ? 0 : -1}
        className={cn(
          "mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-brand px-5 py-3 text-white shadow-pop transition-all duration-300 ease-[var(--ease-smooth)] active:scale-[0.98]",
          visible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <ShoppingCart className="size-5" strokeWidth={2.2} />
          <span>
            السلة <span className="num">({totalQuantity})</span>
          </span>
        </span>

        <span className="flex items-center gap-1">
          <MoneyText value={totalPrice} className="text-sm font-bold" />
          <ChevronLeft className="size-5" strokeWidth={2.4} />
        </span>
      </Link>
    </div>
  );
}
