"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/cart/cart-provider";
import { usePageTransition } from "@/components/shop/page-transition";
import type { CartLine } from "@/lib/cart-types";

type Props = {
  line: CartLine;
  stock: number;
};

/**
 * Fixed purchase bar for the details screen: "أضف للسلة" on the LEFT, a smaller
 * quantity stepper on the RIGHT. Both halves are laid out dir="ltr" so those
 * sides are physical and the stepper reads "+ 1 −" exactly as specified, inside
 * an otherwise RTL page.
 *
 * It writes to the one global cart from `useCart()` — the same store the grid
 * tiles, the floating bar and the cart page use. If this exact variant is
 * already in the cart the stepper starts at its current quantity, so confirming
 * updates that line instead of creating a second one.
 *
 * Adding sends the customer back to the product, where the other
 * denominations are: buying a second card is the common next step, and making
 * them find their own way back through the cart would be one detour too many.
 *
 * Rendered through a portal on purpose: the page-transition wrapper carries a
 * transform while it animates, and a transformed ancestor would make this
 * position:fixed bar scroll with the page instead of sticking to the viewport.
 * The portal moves the DOM node, not the React tree, so the cart and the
 * transition context above still reach it.
 */
export function ProductDetailsActions({ line, stock }: Props) {
  const { quantityOf, add, setQuantity, hydrated } = useCart();
  const router = useRouter();
  const { leave } = usePageTransition();
  const inCart = quantityOf(line.variantId);
  const [quantity, setQuantityDraft] = useState(1);
  const [mounted, setMounted] = useState(false);
  const soldOut = stock <= 0;

  useEffect(() => setMounted(true), []);

  // Seed from the cart once it has been restored from storage / the server.
  useEffect(() => {
    if (!hydrated) return;
    setQuantityDraft(inCart > 0 ? inCart : 1);
  }, [hydrated, inCart]);

  if (!mounted) return null;

  const max = soldOut ? 0 : stock;

  function confirm() {
    if (soldOut) return;
    if (inCart > 0) setQuantity(line.variantId, quantity);
    else add(line, quantity);
    toast.success("تمت الإضافة إلى السلة");

    // Going back rather than pushing the product URL keeps the history stack
    // flat — otherwise adding three cards would leave three dead entries for
    // the phone's own back gesture to walk through.
    leave(() => {
      if (window.history.length > 1) router.back();
      else router.push(`/product/${line.productSlug}`);
    });
  }

  return createPortal(
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-ink-2/95 px-4 py-3 backdrop-blur-xl">
      <div dir="ltr" className="mx-auto flex max-w-2xl items-center gap-3">
        {soldOut ? (
          <span className="flex h-13 flex-1 items-center justify-center rounded-2xl border border-line bg-surface text-sm font-bold text-muted">
            غير متوفر حالياً
          </span>
        ) : (
          <>
            {/* LEFT — the primary action, large and theme-coloured */}
            <button
              type="button"
              onClick={confirm}
              className="tap flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white shadow-card transition-colors hover:bg-brand-600"
            >
              <ShoppingCart className="size-5" />
              أضف للسلة
            </button>

            {/* RIGHT — smaller stepper: + increases, − decreases, never below 1 */}
            <div className="flex h-13 shrink-0 items-center rounded-2xl border border-line bg-surface px-1">
              <button
                type="button"
                onClick={() => setQuantityDraft((value) => Math.min(value + 1, max))}
                disabled={quantity >= max}
                aria-label="زيادة الكمية"
                className="tap grid size-10 place-items-center rounded-xl text-fg transition-colors hover:bg-surface-2 disabled:opacity-35"
              >
                <Plus className="size-4.5" strokeWidth={2.6} />
              </button>

              <span
                aria-live="polite"
                className="num min-w-8 text-center text-base font-bold tabular-nums text-fg"
              >
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantityDraft((value) => Math.max(value - 1, 1))}
                disabled={quantity <= 1}
                aria-label="إنقاص الكمية"
                className="tap grid size-10 place-items-center rounded-xl text-fg transition-colors hover:bg-surface-2 disabled:opacity-35"
              >
                <Minus className="size-4.5" strokeWidth={2.6} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
