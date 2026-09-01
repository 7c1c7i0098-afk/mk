import Link from "next/link";
import { Thumb } from "@/components/ui/thumb";
import {
  TILE_CLASS,
  TILE_GRID_CLASS,
  TILE_IMAGE_SIZES,
  TILE_LABEL_CLASS,
  TILE_SURFACE,
} from "@/components/shop/tile-layout";
import { cn } from "@/lib/utils";

type ProductItem = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

type ProductGridProps = {
  products: ProductItem[];
  /**
   * Tighter tiles for the homepage "كل الفئات" block: still exactly three per
   * row on mobile, but each tile is capped so it never stretches to fill the
   * row, and wider screens simply fit more columns instead of inflating them.
   * The featured category strip uses the same constants, so both blocks show
   * cards of identical size.
   */
  compact?: boolean;
};

/** Marketplace grid — exactly 3 items per row: square image + name underneath. */
export function ProductGrid({ products, compact = false }: ProductGridProps) {
  return (
    <div className={cn(compact ? TILE_GRID_CLASS : "grid grid-cols-3 gap-3 sm:gap-4")}>
      {products.map((product, index) => (
        <Link
          key={product.id}
          href={`/product/${product.slug}`}
          style={{ "--i": index } as React.CSSProperties}
          className={cn(
            "tile-in tap group flex min-w-0 flex-col gap-2",
            compact && `${TILE_CLASS} gap-1.5`,
          )}
        >
          <Thumb
            src={product.image}
            alt={product.name}
            sizes={compact ? TILE_IMAGE_SIZES : "(max-width: 640px) 31vw, 200px"}
            surface={TILE_SURFACE}
            className="transition group-hover:ring-brand/50"
          />
          {/* Centred under its own image, across the full width of the card. */}
          <span
            className={cn(
              TILE_LABEL_CLASS,
              "font-bold text-fg",
              compact ? "text-xs sm:text-[13px]" : "text-[13px] sm:text-sm",
            )}
          >
            {product.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
