"use client";

import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/cart/cart-provider";
import type { CartLine } from "@/lib/cart-types";
import { cn } from "@/lib/utils";

type QuantityControlProps = {
  line: CartLine;
  /** Available stock; the quantity never goes past it. */
  stock?: number;
  size?: "sm" | "md";
  /** Pill stretches to the container width — used over product artwork. */
  fullWidth?: boolean;
  /**
   * Where the collapsed "+" circle sits. "left" is the PHYSICAL left edge — it
   * is not mirrored for RTL, because the tile layout pins it to the lower-left
   * corner of the artwork on every card.
   */
  plusAlign?: "center" | "left";
  className?: string;
};

/**
 * Circular + button that morphs into a "+ 1 −" pill once the variant is in the
 * cart. Every press updates the global cart immediately — there is no separate
 * "add to cart" step.
 *
 * Both states share one CSS grid cell, so the control always has real
 * dimensions and its tap targets stay finger-sized on mobile.
 */
export function QuantityControl({
  line,
  stock,
  size = "md",
  fullWidth = false,
  plusAlign = "center",
  className,
}: QuantityControlProps) {
  const { quantityOf, add, increment, decrement } = useCart();
  const quantity = quantityOf(line.variantId);
  const soldOut = stock !== undefined && stock <= 0;

  const height = size === "sm" ? "h-9" : "h-10";
  // Rounded square, not a circle — the radius stays well short of half the side.
  const square = size === "sm" ? "size-9 rounded-xl" : "size-10 rounded-xl";
  const icon = size === "sm" ? "size-4" : "size-4.5";

  function handleAdd() {
    if (soldOut) return;
    if (quantity === 0) {
      add(line, 1);
      return;
    }
    if (stock !== undefined && quantity >= stock) {
      toast.error("لا توجد كمية إضافية متاحة");
      return;
    }
    increment(line.variantId, stock);
  }

  if (soldOut) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-line bg-ink px-3 text-[11px] font-medium text-muted",
          height,
          fullWidth && "w-full",
          className,
        )}
      >
        غير متوفر
      </span>
    );
  }

  // Shared by both pill buttons: finger-sized, no tap delay, no text selection.
  //
  // The press feedback is drawn in the pill's own foreground colour rather than
  // white, so it reads on a grey pill in the dark theme and on a white one in
  // the light theme. A fixed white wash disappears entirely against white.
  const pillButton =
    "grid h-full place-items-center rounded-full touch-manipulation select-none transition-colors hover:bg-plus-fg/10 active:bg-plus-fg/20";

  return (
    <div
      className={cn(
        "relative grid place-items-center",
        height,
        fullWidth ? "w-full" : "w-auto",
        className,
      )}
    >
      {/* Collapsed state — the plus button is itself the add-to-cart action */}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`إضافة ${line.variantName} إلى السلة`}
        className={cn(
          // Neutral, theme-driven: grey box + white glyph in dark, white box +
          // dark grey glyph in light. Both come from the palette, so the button
          // follows the theme automatically.
          // No shadow, glow or backdrop blur: a crisp hairline edge is what
          // separates the button from the artwork underneath.
          "tap grid touch-manipulation select-none place-items-center bg-plus text-plus-fg ring-1 ring-black/10 transition-all duration-200 ease-[var(--ease-smooth)] hover:brightness-95",
          plusAlign === "left"
            ? "absolute bottom-0 left-0"
            : "col-start-1 row-start-1",
          square,
          quantity > 0 && "pointer-events-none scale-50 opacity-0",
        )}
      >
        <Plus className={icon} strokeWidth={2.6} />
      </button>

      {/* Expanded state */}
      <div
        aria-hidden={quantity === 0}
        className={cn(
          // Same neutral pair as the collapsed button: grey box in the dark
          // theme, white in the light one. The hairline keeps a white pill from
          // dissolving into a white surface behind it.
          "col-start-1 row-start-1 flex items-center rounded-full bg-plus p-1 text-plus-fg ring-1 ring-black/10 transition-all duration-200 ease-[var(--ease-smooth)]",
          height,
          fullWidth ? "w-full justify-between" : "w-auto gap-1",
          quantity === 0 && "pointer-events-none scale-75 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={handleAdd}
          tabIndex={quantity === 0 ? -1 : 0}
          aria-label="زيادة الكمية"
          className={cn(pillButton, fullWidth ? "flex-1" : "aspect-square")}
        >
          <Plus className={icon} strokeWidth={2.6} />
        </button>

        <span
          aria-live="polite"
          className="num min-w-6 shrink-0 text-center text-sm font-bold tabular-nums"
        >
          {quantity}
        </span>

        <button
          type="button"
          onClick={() => decrement(line.variantId)}
          tabIndex={quantity === 0 ? -1 : 0}
          aria-label="إنقاص الكمية"
          className={cn(pillButton, fullWidth ? "flex-1" : "aspect-square")}
        >
          <Minus className={icon} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
