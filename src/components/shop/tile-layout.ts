/**
 * Square-tile layout shared by the storefront grids.
 *
 * The two blocks deliberately run at different densities: the featured category
 * strip is four per row, the "كل الفئات" grid is three. What they DO share is
 * the shape and the label treatment, which is what lives here.
 *
 * These constants are purely dimensional. Artwork is never touched: each grid
 * keeps rendering the image the admin uploaded, exactly as uploaded.
 */

/** "كل الفئات" — exactly three per row on mobile; more columns (never wider tiles) after that. */
export const TILE_GRID_CLASS = "grid grid-cols-3 gap-x-5 gap-y-5 sm:grid-cols-5 md:grid-cols-6";

/**
 * Caps the tile so a short row never stretches its cards to fill the width.
 * The cap also does the trimming: the grid columns are untouched, the card is
 * simply drawn a few pixels narrower inside its column and centred there, so
 * spacing and the three-per-row layout stay exactly as they were.
 */
export const TILE_CLASS = "mx-auto w-full max-w-[100px]";

/**
 * Featured categories — exactly four per row on mobile, wrapping so a fifth
 * category starts the next row on its own. Nothing counts or caps the items,
 * so whatever the admin adds flows in. Never a carousel.
 */
export const CATEGORY_GRID_CLASS =
  "grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 md:grid-cols-8";

/** Narrower cap than TILE_CLASS so four fit comfortably across a phone. */
export const CATEGORY_TILE_CLASS = "mx-auto w-full max-w-[92px]";

export const CATEGORY_IMAGE_SIZES = "(max-width: 640px) 22vw, 92px";

export const TILE_ROUNDED = "rounded-2xl";

/**
 * Surface behind the artwork on BOTH storefront grids.
 *
 * It is the page background token, so a tile blends into the page instead of
 * reading as a separate block — which matters because the category artwork is
 * transparent PNG and this colour shows through wherever the art is cut out.
 * Deliberately not `bg-surface`: that token is pure #FFFFFF in light mode and
 * would show as a bright white square behind every transparent image.
 */
export const TILE_SURFACE = "bg-ink";

export const TILE_IMAGE_SIZES = "(max-width: 640px) 27vw, 100px";

/**
 * Label under the artwork. `block w-full` + `text-center` means the name is
 * centred against the full width of its own card, and the clamp keeps a long
 * name from pushing the row out of alignment.
 *
 * The generous line-height is not decoration. `line-clamp` is `overflow:
 * hidden`, and Arabic hangs a great deal below the baseline — the dots under
 * ي, the tail of و, the bowls of ج and ح. A tight leading crops exactly those,
 * so "ببجي" loses the dots that distinguish its last letter. The extra padding
 * gives the final line the same room, since overflow clips at the padding edge.
 */
export const TILE_LABEL_CLASS =
  "block w-full line-clamp-2 break-words pb-0.5 text-center leading-[1.75]";
