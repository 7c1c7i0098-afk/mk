import "server-only";

import { prisma } from "@/lib/db";
import { getDefaultRule } from "@/lib/suppliers/service";
import { quotePrice, toRule, type MarkupRule, type PriceQuote } from "@/lib/suppliers/pricing";

/**
 * Keeping automatic prices in step with supplier costs.
 *
 * This is the only place that writes `ProductVariant.price` on behalf of a
 * supplier, and it refuses to touch a variant whose `priceMode` is MANUAL —
 * which is how "supplier cost changed, but my hand-set price stayed" is
 * guaranteed rather than merely intended.
 */

/** Everything the pricing decision needs, in one query shape. */
const PRICING_SELECT = {
  id: true,
  isPreferred: true,
  isEnabled: true,
  supplierProduct: {
    select: {
      id: true,
      name: true,
      cost: true,
      currency: true,
      availability: true,
      externalProductId: true,
      externalVariantId: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      currency: true,
      rateMicros: true,
      markupType: true,
      markupValue: true,
      status: true,
    },
  },
  variant: {
    select: {
      id: true,
      name: true,
      price: true,
      priceMode: true,
      markupType: true,
      markupValue: true,
      product: {
        select: { id: true, name: true, markupType: true, markupValue: true },
      },
    },
  },
} as const;

export type PricingRow = {
  id: string;
  isPreferred: boolean;
  isEnabled: boolean;
  supplierProduct: {
    id: string;
    name: string;
    cost: number;
    currency: string;
    availability: string;
    externalProductId: string;
    externalVariantId: string;
  };
  supplier: {
    id: string;
    name: string;
    currency: string;
    rateMicros: number | null;
    markupType: MarkupRule["type"];
    markupValue: number;
    status: string;
  };
  variant: {
    id: string;
    name: string;
    price: number;
    priceMode: "MANUAL" | "AUTO";
    markupType: MarkupRule["type"] | null;
    markupValue: number | null;
    product: {
      id: string;
      name: string;
      markupType: MarkupRule["type"] | null;
      markupValue: number | null;
    };
  };
};

/**
 * The full precedence chain for one mapping, resolved.
 *
 * The supplier rule is passed as a real rule (never null) because a supplier
 * always has one — its default is PERCENT 0, i.e. "sell at cost" — which is
 * what makes the DEFAULT level a genuine fallback rather than the norm.
 */
export function quoteForRow(row: PricingRow, defaultRule: MarkupRule): PriceQuote {
  return quotePrice({
    supplierCost: row.supplierProduct.cost,
    supplierCurrency: row.supplierProduct.currency || row.supplier.currency,
    rateMicros: row.supplier.rateMicros,
    priceMode: row.variant.priceMode,
    currentPrice: row.variant.price,
    variantRule: toRule(row.variant.markupType, row.variant.markupValue),
    productRule: toRule(row.variant.product.markupType, row.variant.product.markupValue),
    supplierRule: { type: row.supplier.markupType, value: row.supplier.markupValue },
    defaultRule,
  });
}

/** Loads the preferred, enabled mapping for each of the given variants. */
export async function loadPricingRows(where: {
  supplierId?: string;
  variantIds?: string[];
}): Promise<PricingRow[]> {
  const rows = await prisma.productSupplierMapping.findMany({
    where: {
      isPreferred: true,
      isEnabled: true,
      supplierId: where.supplierId,
      variantId: where.variantIds ? { in: where.variantIds } : undefined,
    },
    select: PRICING_SELECT,
  });

  return rows as unknown as PricingRow[];
}

export type RepriceOutcome = {
  /** Variants whose stored price actually moved. */
  repriced: number;
  /** AUTO variants that could not be priced — missing exchange rate, etc. */
  blocked: number;
  /** MANUAL variants, left untouched on purpose. */
  manual: number;
};

/**
 * Recalculates every automatic price affected by the given scope.
 *
 * Called after a sync (costs may have moved), after a markup change, and after
 * an import. Idempotent: running it twice with unchanged costs writes nothing.
 */
export async function repriceVariants(where: {
  supplierId?: string;
  variantIds?: string[];
}): Promise<RepriceOutcome> {
  const [rows, defaultRule] = await Promise.all([loadPricingRows(where), getDefaultRule()]);

  const outcome: RepriceOutcome = { repriced: 0, blocked: 0, manual: 0 };
  const updates: { id: string; price: number }[] = [];

  for (const row of rows) {
    if (row.variant.priceMode === "MANUAL") {
      outcome.manual++;
      continue;
    }

    const quote = quoteForRow(row, defaultRule);
    if (!quote.ok) {
      outcome.blocked++;
      continue;
    }
    // Never let a sync drive a live price to zero: a cost that rounds away
    // leaves the existing price alone and is reported as blocked.
    if (quote.finalPrice <= 0) {
      outcome.blocked++;
      continue;
    }
    if (quote.finalPrice !== row.variant.price) {
      updates.push({ id: row.variant.id, price: quote.finalPrice });
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.productVariant.update({ where: { id: update.id }, data: { price: update.price } }),
      ),
    );
    outcome.repriced = updates.length;
  }

  return outcome;
}
