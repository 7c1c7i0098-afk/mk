"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/cart/cart-provider";
import { EmptyCart } from "@/components/cart/empty-cart";
import { QuantityControl } from "@/components/cart/quantity-control";
import { BackButton } from "@/components/shop/back-button";
import { Thumb } from "@/components/ui/thumb";
import { MoneyText } from "@/components/shop/money-text";
import { quoteLines } from "@/lib/pricing";
import { useDiscountRates } from "@/components/shop/discount-provider";

export function CartView({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const { items, hydrated, totalPrice, add, remove, clear } = useCart();
  const rates = useDiscountRates();

  // Same helper the server prices an order with, so the figure shown here and
  // the figure charged later come from one implementation.
  const quote = quoteLines(items, rates);

  /**
   * Checkout is the first point where an account is required. The cart is never
   * cleared — the customer returns straight back here after authenticating.
   */
  function checkout() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/cart")}`);
      return;
    }
    router.push("/checkout");
  }

  /** Emptying the whole cart is one tap, so it is offered with a way back. */
  function clearAll() {
    const snapshot = items;
    clear();
    toast.success("تم إفراغ السلة", {
      action: {
        label: "تراجع",
        onClick: () => {
          for (const item of snapshot) {
            add(
              {
                productId: item.productId,
                productSlug: item.productSlug,
                productName: item.productName,
                variantId: item.variantId,
                variantName: item.variantName,
                image: item.image,
                unitPrice: item.unitPrice,
              },
              item.quantity,
            );
          }
        },
      },
    });
  }

  const empty = hydrated && items.length === 0;

  return (
    <div className="space-y-5">
      {/* Back arrow, centred title, empty-the-cart. The arrow and the bin are
          the same width (size-10 pulled in by -m-2), so the title sits on the
          true centre of the screen rather than near it. */}
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="flex-1 pb-0.5 text-center text-lg font-bold leading-[1.6] text-fg">
          السلة
        </h1>
        <button
          type="button"
          onClick={clearAll}
          disabled={items.length === 0}
          aria-label="إفراغ السلة"
          className="tap -m-2 grid size-10 shrink-0 place-items-center text-muted transition hover:text-fg disabled:pointer-events-none disabled:text-muted-2/50"
        >
          <FullBin />
        </button>
      </div>

      {!hydrated ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : empty ? (
        <EmptyCart />
      ) : (
        /* Tall enough to reach the bottom navigation, so mt-auto can drop the
           total onto the foot of the screen while both stay in normal flow —
           a fixed bar would need the list to reserve space for it by hand. */
        <div className="flex min-h-[calc(100dvh-10rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col gap-5">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-stretch gap-3 py-4">
                <Link href={`/product/${item.productSlug}`} className="shrink-0">
                  <Thumb
                    src={item.image}
                    alt={item.variantName}
                    sizes="96px"
                    rounded="rounded-2xl"
                    className="size-24"
                  />
                </Link>

                {/* Stretched to the artwork and pushed apart, so the name sits level with
                    the top of the image and the price level with its foot. */}
                <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                  {/* Name, with the bin facing it on the same line. */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="min-w-0 flex-1 truncate pb-0.5 text-sm font-bold leading-[1.7] text-fg hover:text-brand"
                    >
                      {item.variantName}
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        remove(item.variantId);
                        toast.success("تمت إزالة المنتج من السلة");
                      }}
                      aria-label={`إزالة ${item.variantName}`}
                      className="tap -m-2 grid size-10 shrink-0 place-items-center text-muted transition hover:text-danger"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>

                  {/* Price, with the quantity facing it on the same line. The
                      price is the unit price and only ever the unit price — it
                      must not move when the quantity does. */}
                  <div className="flex items-center gap-2">
                    <MoneyText
                      value={item.unitPrice}
                      className="min-w-0 flex-1 text-base font-bold text-fg"
                    />

                    <QuantityControl
                      size="sm"
                      line={{
                        productId: item.productId,
                        productSlug: item.productSlug,
                        productName: item.productName,
                        variantId: item.variantId,
                        variantName: item.variantName,
                        image: item.image,
                        unitPrice: item.unitPrice,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <section className="mt-auto space-y-3 border-t border-line pt-4">
            {/* Subtotal is worth showing only when something is taken off it —
                otherwise it is the total repeated twice. */}
            {quote.discount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">المجموع الفرعي</span>
                  <MoneyText value={totalPrice} className="font-semibold text-fg" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">الخصم الخاص بك</span>
                  <MoneyText value={-quote.discount} sign className="font-semibold text-success" />
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-2 text-base">
              <span className="font-bold text-fg">الإجمالي</span>
              <MoneyText value={quote.total} className="text-lg font-bold text-brand" />
            </div>

            <button
              type="button"
              onClick={checkout}
              className="tap w-full rounded-xl bg-brand py-3.5 text-sm font-bold text-white hover:bg-brand-600"
            >
              إتمام الطلب
            </button>

            {!isAuthenticated && (
              <p className="text-center text-xs text-muted-2">
                سيُطلب منك تسجيل الدخول لإتمام الطلب — سلتك محفوظة ولن تفقدها
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * The empty-the-cart glyph: a solid bin with two ribs cut out of it.
 *
 * Hand-drawn rather than taken from the icon set, because a filled lucide bin
 * is a featureless blob — the ribs are what make the shape read as a bin. They
 * are knocked out in the page colour rather than drawn in a lighter grey, so
 * they stay crisp in both themes.
 */
function FullBin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6">
      <path d="M9.4 2.5h5.2a1.2 1.2 0 0 1 1.2 1.2v1.4H8.2V3.7a1.2 1.2 0 0 1 1.2-1.2Z" fill="currentColor" />
      <rect x="3" y="5.9" width="18" height="2.5" rx="1.25" fill="currentColor" />
      <path
        d="M5.6 9.9h12.8l-.85 9.9a2.1 2.1 0 0 1-2.1 1.92H8.55a2.1 2.1 0 0 1-2.1-1.92L5.6 9.9Z"
        fill="currentColor"
      />
      <g stroke="var(--pc-ink)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M10.1 12.4v6.1" />
        <path d="M13.9 12.4v6.1" />
      </g>
    </svg>
  );
}
