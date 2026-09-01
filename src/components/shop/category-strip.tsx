import Link from "next/link";
import { Thumb } from "@/components/ui/thumb";
import {
  CATEGORY_GRID_CLASS,
  CATEGORY_IMAGE_SIZES,
  CATEGORY_TILE_CLASS,
  TILE_LABEL_CLASS,
  TILE_ROUNDED,
  TILE_SURFACE,
} from "@/components/shop/tile-layout";

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

/**
 * The main categories — the most prominent block on the homepage.
 *
 * A plain wrapping grid, never a carousel: four per row on mobile, and a fifth
 * category simply starts the next row. Nothing here counts or caps the
 * categories, so whatever the admin adds flows in automatically and RTL order
 * is preserved by the grid itself.
 *
 * The tiles are squares with the same corner radius and centred label as the
 * grid below, just at a tighter four-across width. Only the displayed
 * dimensions are set here — the artwork stays the file the admin uploaded,
 * shown at full bleed with no ring.
 */
export function CategoryStrip({ categories }: { categories: CategoryItem[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-label="الفئات الرئيسية">
      <div className={CATEGORY_GRID_CLASS}>
        {categories.map((category, index) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            style={{ "--i": index } as React.CSSProperties}
            className={`tile-in tap group flex min-w-0 flex-col gap-1.5 ${CATEGORY_TILE_CLASS}`}
          >
            {/* The supplied artwork carries its own rounded frame and is already
                cropped tight, so it is shown at full size with no ring. */}
            <Thumb
              src={category.image}
              alt={category.name}
              sizes={CATEGORY_IMAGE_SIZES}
              rounded={TILE_ROUNDED}
              surface={TILE_SURFACE}
              ringed={false}
              // No shadow: the tile shares the page background, so a card
              // shadow would draw a floating rectangle around nothing.
              className="transition group-hover:brightness-110"
            />
            <span className={`${TILE_LABEL_CLASS} text-xs font-bold text-fg sm:text-[13px]`}>
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
