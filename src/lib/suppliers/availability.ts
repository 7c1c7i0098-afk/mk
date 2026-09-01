import "server-only";

import { prisma } from "@/lib/db";

/**
 * The purchase gate for supplier-backed variants.
 *
 * A manually created variant is unaffected — no mapping, no opinion. A
 * supplier-backed one is sellable only when its preferred mapping is enabled,
 * its supplier is active, and the supplier says the item is AVAILABLE.
 * UNKNOWN blocks the sale: not knowing is not the same as being in stock, and
 * the cost of a wrong "yes" here is an order we cannot fulfil.
 */
export async function getBlockedVariantIds(variantIds: string[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  if (variantIds.length === 0) return blocked;

  const mappings = await prisma.productSupplierMapping.findMany({
    where: { variantId: { in: variantIds } },
    select: {
      variantId: true,
      isPreferred: true,
      isEnabled: true,
      supplier: { select: { status: true } },
      supplierProduct: { select: { availability: true, missingSince: true } },
    },
  });

  /** variantId -> has at least one mapping that can currently be fulfilled. */
  const sellable = new Map<string, boolean>();

  for (const mapping of mappings) {
    const current = sellable.get(mapping.variantId) ?? false;
    const ok =
      mapping.isPreferred &&
      mapping.isEnabled &&
      mapping.supplier.status === "ACTIVE" &&
      mapping.supplierProduct.missingSince === null &&
      mapping.supplierProduct.availability === "AVAILABLE";

    sellable.set(mapping.variantId, current || ok);
  }

  for (const [variantId, ok] of sellable) {
    if (!ok) blocked.add(variantId);
  }

  return blocked;
}

/** Convenience for a single variant — used by the product page. */
export async function isVariantPurchasable(variantId: string): Promise<boolean> {
  const blocked = await getBlockedVariantIds([variantId]);
  return !blocked.has(variantId);
}

/**
 * How many of a supplier-backed item one customer may put in a basket.
 *
 * Supplier items have no local stock — the provider fulfils on demand — so the
 * storefront needs *some* ceiling. This is a sanity limit, not an inventory
 * count.
 */
export const SUPPLIER_STOCK_CAP = 20;

/**
 * Resolves the stock figure the storefront should actually show.
 *
 * `ProductVariant.stock` carries two different meanings depending on where a
 * variant came from, and conflating them is what made freshly imported items
 * read as sold out:
 *
 *   • **Manual variants** count real inventory, where 0 genuinely means "none
 *     left".
 *   • **Supplier-backed variants** are imported with 0 meaning "we hold none —
 *     the provider ships it", which is the opposite of unavailable.
 *
 * So supplier-backed rows ignore the stored number entirely and answer from the
 * provider instead: the cap when it can fulfil, zero when it cannot. Manual
 * rows pass through untouched.
 */
export async function resolveStorefrontStock(
  variants: { id: string; stock: number }[],
): Promise<Map<string, number>> {
  const resolved = new Map(variants.map((variant) => [variant.id, variant.stock]));
  if (variants.length === 0) return resolved;

  const ids = variants.map((variant) => variant.id);

  const [supplierBacked, blocked] = await Promise.all([
    prisma.productSupplierMapping.findMany({
      where: { variantId: { in: ids } },
      select: { variantId: true },
      distinct: ["variantId"],
    }),
    getBlockedVariantIds(ids),
  ]);

  for (const { variantId } of supplierBacked) {
    resolved.set(variantId, blocked.has(variantId) ? 0 : SUPPLIER_STOCK_CAP);
  }

  return resolved;
}
