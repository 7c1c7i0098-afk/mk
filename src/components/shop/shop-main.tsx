"use client";

import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import { PageTransition } from "@/components/shop/page-transition";
import { cn } from "@/lib/utils";

/** Adds extra bottom padding while the floating cart bar is on screen. */
export function ShopMain({ children }: { children: React.ReactNode }) {
  const { totalQuantity, hydrated } = useCart();
  const pathname = usePathname();
  // Kept in step with BottomNav: where the tabs are hidden, the padding that
  // holds them clear has nothing to hold clear.
  const fullScreen = pathname === "/support";
  // The cart and checkout screens hide the floating bar, so they must not
  // reserve room for it either — that gap is where their own bars sit.
  const cartBarVisible = hydrated && totalQuantity > 0 && pathname !== "/cart" && pathname !== "/checkout";

  return (
    <main
      className={cn(
        "mx-auto w-full max-w-5xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] transition-[padding] duration-300 md:px-6",
        fullScreen
          ? "pb-[env(safe-area-inset-bottom)]"
          : cartBarVisible
            ? "pb-cart"
            : "pb-nav",
      )}
    >
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
