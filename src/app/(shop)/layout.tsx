import { CartProvider } from "@/components/cart/cart-provider";
import { FloatingCartBar } from "@/components/cart/floating-cart-bar";
import { BottomNav } from "@/components/shop/bottom-nav";
import { DiscountProvider } from "@/components/shop/discount-provider";
import { ShopMain } from "@/components/shop/shop-main";
import { getDiscountRates } from "@/lib/pricing-server";
import { getCurrentUser } from "@/lib/session";

/**
 * Storefront shell: cart state, content area, floating cart bar and the fixed
 * bottom navigation. The search / favorites / balance controls are NOT here —
 * they belong to the homepage only.
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const rates = await getDiscountRates(user?.id);

  return (
    <DiscountProvider rates={rates}>
      <CartProvider isAuthenticated={Boolean(user)}>
        <div className="min-h-dvh bg-ink">
          <ShopMain>{children}</ShopMain>
          <FloatingCartBar />
          <BottomNav />
        </div>
      </CartProvider>
    </DiscountProvider>
  );
}
