"use client";

import Link from "next/link";
import { QuantityControl } from "@/components/cart/quantity-control";
import { Thumb } from "@/components/ui/thumb";
import { MoneyText } from "@/components/shop/money-text";

export type VariantTile = {
  id: string;
  name: string;
  value: string | null;
  /** List price, in minor units. */
  price: number;
  /** What this customer pays — computed on the server from their discount. */
  finalPrice: number;
  stock: number;
};

type VariantGridProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
  };
  variants: VariantTile[];
};

/**
 * Denominations of a product — three per row on mobile.
 *
 * Tapping the card opens the details screen; the "+" control sits in the
 * lower-LEFT corner of the artwork (physical left, not mirrored for RTL) and is
 * kept outside the link so adding to the cart never navigates away.
 */
export function VariantGrid({ product, variants }: VariantGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {variants.map((variant) => {
        const label = variant.value ?? variant.name;
        const href = `/product/${product.slug}/${variant.id}`;
        // Zero here already means "cannot be sold": supplier-backed items are
        // resolved to 0 by resolveStorefrontStock when the provider cannot fill
        // them, so this covers both manual stock and an upstream outage.
        const soldOut = variant.stock <= 0;

        return (
          <div key={variant.id} className="flex flex-col gap-1.5">
            <div className="relative isolate">
              <Link
                href={href}
                aria-label={`${product.name} — ${label}`}
                className="tap block"
              >
                <Thumb
                  src={product.image}
                  alt={`${product.name} — ${label}`}
                  sizes="(max-width: 640px) 31vw, 200px"
                  dimmed={soldOut}
                />
              </Link>

              {/* z-10 keeps the control above neighbouring tiles in the grid */}
              <div className="absolute inset-x-1.5 bottom-1.5 z-10">
                <QuantityControl
                  fullWidth
                  size="sm"
                  plusAlign="left"
                  stock={variant.stock}
                  line={{
                    productId: product.id,
                    productSlug: product.slug,
                    productName: product.name,
                    variantId: variant.id,
                    variantName: label,
                    image: product.image,
                    unitPrice: variant.price,
                    // The cart stores the list price; the discount is applied
                    // when totals are shown and again when an order is priced.
                  }}
                />
              </div>
            </div>

            {/* Price right-aligned inside the card, the name right underneath
                it. min-w-0 + break-words keep long names inside the tile. */}
            <Link
              href={href}
              className="tap flex min-w-0 flex-col gap-1 text-right"
            >
              <MoneyText
                value={variant.finalPrice}
                className="text-sm font-bold text-fg"
              />
              {variant.finalPrice < variant.price && (
                <MoneyText
                  value={variant.price}
                  className="text-[11px] text-muted-2 line-through"
                />
              )}
              <span className="line-clamp-2 break-words pb-0.5 text-xs leading-[1.75] text-muted">
                {label}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
