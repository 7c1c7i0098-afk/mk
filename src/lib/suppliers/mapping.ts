import "server-only";

import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { logSupplierAction, getDefaultRule } from "@/lib/suppliers/service";
import { quotePrice, toRule } from "@/lib/suppliers/pricing";
import type { MarkupType, PriceMode } from "@/generated/prisma/enums";

/**
 * Turning selected supplier items into PLUS CARD products.
 *
 * This is the only door between the staging catalog and the storefront, and it
 * is opened one explicit admin action at a time. Two invariants hold here:
 *
 *   • **No duplicates.** A mapping is unique per (variant, supplierProduct),
 *     and re-importing an item that already has one updates instead of adding.
 *     Items from the same `externalProductId` are grouped under the local
 *     product an earlier import already created, so a second import of the same
 *     brand adds denominations rather than a second product.
 *   • **One preferred supplier per variant.** Setting a preferred mapping
 *     clears the others inside the same transaction, so the storefront can
 *     never see two.
 */

/** Ensures a unique product slug, appending a counter when needed. */
async function uniqueProductSlug(desired: string): Promise<string> {
  const base = slugify(desired) || "item";
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

export type ImportOptions = {
  supplierId: string;
  supplierProductIds: string[];
  adminId: string;
  /** Map everything into this existing product instead of creating new ones. */
  targetProductId?: string | null;
  /** Category for products this import has to create. */
  categoryId?: string | null;
  /** AUTO follows supplier cost; MANUAL freezes the price at import time. */
  priceMode: PriceMode;
  /**
   * Markup written onto every variant this import creates, as the narrowest
   * rule in the precedence chain. Null leaves them inheriting the product,
   * supplier and default rules as before — which is what lets one batch be
   * imported at a percentage and the next at a flat amount.
   */
  markupType?: MarkupType | null;
  /** Basis points for PERCENT, minor units for FIXED. */
  markupValue?: number;
  /** Publish the created variants immediately. */
  activate: boolean;
};

export type ImportResult = {
  createdProducts: number;
  createdVariants: number;
  linkedExisting: number;
  /** Items that already had a mapping — left exactly as they were. */
  skipped: number;
  /** Items that could not be priced (usually a missing exchange rate). */
  unpriced: number;
  errors: string[];
};

/**
 * Imports selected catalog rows.
 *
 * Runs item by item rather than in one transaction on purpose: a single
 * unpriceable row should not throw away the ninety-nine that imported cleanly,
 * and every step is individually idempotent anyway.
 */
export async function importSupplierProducts(options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    createdProducts: 0,
    createdVariants: 0,
    linkedExisting: 0,
    skipped: 0,
    unpriced: 0,
    errors: [],
  };

  if (options.supplierProductIds.length === 0) return result;

  const [supplier, defaultRule] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: options.supplierId },
      select: {
        id: true,
        name: true,
        currency: true,
        rateMicros: true,
        markupType: true,
        markupValue: true,
      },
    }),
    getDefaultRule(),
  ]);

  if (!supplier) {
    result.errors.push("المزوّد غير موجود");
    return result;
  }

  const items = await prisma.supplierProduct.findMany({
    where: { id: { in: options.supplierProductIds }, supplierId: options.supplierId },
    select: {
      id: true,
      externalProductId: true,
      externalVariantId: true,
      name: true,
      category: true,
      variantLabel: true,
      cost: true,
      currency: true,
      mappings: { select: { id: true } },
    },
    orderBy: [{ externalProductId: "asc" }, { cost: "asc" }],
  });

  // Falls back to any category only when the admin did not choose one and an
  // import needs to create a product.
  let fallbackCategoryId = options.categoryId ?? null;

  /** externalProductId -> local product id, for this run and earlier ones. */
  const productByExternalId = new Map<string, string>();

  for (const item of items) {
    if (item.mappings.length > 0) {
      result.skipped++;
      continue;
    }

    // ── price the item before anything is created ──────────────────────────
    const quote = quotePrice({
      supplierCost: item.cost,
      supplierCurrency: item.currency || supplier.currency,
      rateMicros: supplier.rateMicros,
      priceMode: "AUTO",
      currentPrice: 0,
      variantRule: toRule(options.markupType ?? null, options.markupValue ?? 0),
      supplierRule: { type: supplier.markupType, value: supplier.markupValue },
      defaultRule,
    });

    if (!quote.ok) {
      result.unpriced++;
      if (quote.reason && !result.errors.includes(quote.reason)) result.errors.push(quote.reason);
      continue;
    }

    // A zero price is refused outright, never published.
    //
    // Some providers quote per-unit rates so small they round to nothing in
    // minor units — Libya Play's social services are priced at fractions of a
    // dirham per unit and sold in millions. Importing one of those at the
    // rounded cost would put a free product on the storefront, so the item is
    // skipped and reported instead.
    if (quote.finalPrice <= 0) {
      result.unpriced++;
      const reason =
        "عناصر بسعر صفر لم تُستورد — المزوّد يسعّرها لكل وحدة بكسور صغيرة، وتحتاج كمية وسعراً يدوياً";
      if (!result.errors.includes(reason)) result.errors.push(reason);
      continue;
    }

    try {
      // ── find or create the local product ────────────────────────────────
      let productId = options.targetProductId ?? productByExternalId.get(item.externalProductId);

      if (!productId) {
        // An earlier import may already have created it — reuse rather than
        // duplicate. The link is the supplier's own product id.
        const sibling = await prisma.productSupplierMapping.findFirst({
          where: {
            supplierId: options.supplierId,
            supplierProduct: { externalProductId: item.externalProductId },
          },
          select: { variant: { select: { productId: true } } },
        });
        productId = sibling?.variant.productId;
      }

      if (!productId) {
        if (!fallbackCategoryId) {
          const category = await prisma.category.findFirst({
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          });
          if (!category) {
            result.errors.push("أنشئ فئة واحدة على الأقل قبل استيراد منتجات جديدة");
            break;
          }
          fallbackCategoryId = category.id;
        }

        // The supplier's line name usually carries the denomination
        // ("Steam 10"); the local product takes the brand part.
        const productName = item.variantLabel
          ? item.name.replace(item.variantLabel, "").trim() || item.name
          : item.name;

        const created = await prisma.product.create({
          data: {
            name: productName,
            slug: await uniqueProductSlug(productName),
            categoryId: fallbackCategoryId,
            // Created hidden unless the admin asked to publish: an import must
            // never put an unfinished product in front of a customer.
            isActive: options.activate,
          },
          select: { id: true },
        });
        productId = created.id;
        result.createdProducts++;
      }

      productByExternalId.set(item.externalProductId, productId);

      // ── create the local variant + its mapping, atomically ──────────────
      await prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.create({
          data: {
            productId,
            name: item.name,
            value: item.variantLabel,
            price: quote.finalPrice,
            priceMode: options.priceMode,
            markupType: options.markupType ?? null,
            markupValue: options.markupType ? (options.markupValue ?? 0) : null,
            // Supplier-backed items are not stock-counted locally; the
            // supplier's availability is the real gate.
            stock: 0,
            isActive: options.activate,
          },
          select: { id: true },
        });

        await tx.productSupplierMapping.create({
          data: {
            supplierId: options.supplierId,
            supplierProductId: item.id,
            variantId: variant.id,
            // First supplier for a fresh variant is by definition the one to use.
            isPreferred: true,
            isEnabled: true,
          },
        });

        await tx.supplierProduct.update({
          where: { id: item.id },
          data: { isSelected: true },
        });
      });

      result.createdVariants++;
    } catch (error) {
      console.error("[suppliers/import]", error);
      result.errors.push(`تعذّر استيراد "${item.name}"`);
    }
  }

  await logSupplierAction({
    adminId: options.adminId,
    supplierId: options.supplierId,
    supplierName: supplier.name,
    action: "MAPPING_CREATE",
    detail: `استيراد ${result.createdVariants} عنصراً · ${result.createdProducts} منتج جديد · ${result.skipped} مرتبط مسبقاً`,
  });

  return result;
}

/**
 * Links a catalog row to a variant that already exists — the second supplier
 * for a card PLUS CARD already sells, or a supplier item attached to a manually
 * created product.
 */
export async function linkToExistingVariant(options: {
  supplierProductId: string;
  variantId: string;
  adminId: string;
  makePreferred: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const item = await prisma.supplierProduct.findUnique({
    where: { id: options.supplierProductId },
    select: { id: true, name: true, supplierId: true, supplier: { select: { name: true } } },
  });
  if (!item) return { ok: false, error: "عنصر المزوّد غير موجود" };

  const variant = await prisma.productVariant.findUnique({
    where: { id: options.variantId },
    select: { id: true, name: true },
  });
  if (!variant) return { ok: false, error: "الفئة السعرية غير موجودة" };

  await prisma.$transaction(async (tx) => {
    if (options.makePreferred) {
      await tx.productSupplierMapping.updateMany({
        where: { variantId: options.variantId },
        data: { isPreferred: false },
      });
    }

    // Upsert on the (variant, supplierProduct) unique key — re-linking the same
    // pair can never produce a second row.
    await tx.productSupplierMapping.upsert({
      where: {
        variantId_supplierProductId: {
          variantId: options.variantId,
          supplierProductId: options.supplierProductId,
        },
      },
      create: {
        supplierId: item.supplierId,
        supplierProductId: options.supplierProductId,
        variantId: options.variantId,
        isPreferred: options.makePreferred,
        isEnabled: true,
      },
      update: { isEnabled: true, isPreferred: options.makePreferred },
    });

    await tx.supplierProduct.update({ where: { id: item.id }, data: { isSelected: true } });
  });

  await logSupplierAction({
    adminId: options.adminId,
    supplierId: item.supplierId,
    supplierName: item.supplier.name,
    action: "MAPPING_CREATE",
    detail: `ربط "${item.name}" بالفئة السعرية "${variant.name}"`,
  });

  return { ok: true };
}

/** Makes one mapping the active supplier for its variant. */
export async function setPreferredMapping(
  mappingId: string,
  adminId: string,
): Promise<{ ok: boolean; error?: string }> {
  const mapping = await prisma.productSupplierMapping.findUnique({
    where: { id: mappingId },
    select: {
      id: true,
      variantId: true,
      supplierId: true,
      supplier: { select: { name: true } },
      variant: { select: { name: true } },
    },
  });
  if (!mapping) return { ok: false, error: "الربط غير موجود" };

  await prisma.$transaction(async (tx) => {
    await tx.productSupplierMapping.updateMany({
      where: { variantId: mapping.variantId },
      data: { isPreferred: false },
    });
    await tx.productSupplierMapping.update({
      where: { id: mappingId },
      data: { isPreferred: true, isEnabled: true },
    });
  });

  await logSupplierAction({
    adminId,
    supplierId: mapping.supplierId,
    supplierName: mapping.supplier.name,
    action: "PREFERRED_CHANGE",
    detail: `المزوّد المعتمد للفئة "${mapping.variant.name}"`,
  });

  return { ok: true };
}

/**
 * Removes a mapping. When it was the preferred one, another enabled mapping is
 * promoted in the same transaction — a variant is never left supplier-backed
 * with nobody to fulfil it.
 */
export async function removeMapping(
  mappingId: string,
  adminId: string,
): Promise<{ ok: boolean; error?: string }> {
  const mapping = await prisma.productSupplierMapping.findUnique({
    where: { id: mappingId },
    select: {
      id: true,
      variantId: true,
      isPreferred: true,
      supplierId: true,
      supplier: { select: { name: true } },
      supplierProduct: { select: { name: true } },
    },
  });
  if (!mapping) return { ok: false, error: "الربط غير موجود" };

  await prisma.$transaction(async (tx) => {
    await tx.productSupplierMapping.delete({ where: { id: mappingId } });

    if (mapping.isPreferred) {
      const successor = await tx.productSupplierMapping.findFirst({
        where: { variantId: mapping.variantId, isEnabled: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (successor) {
        await tx.productSupplierMapping.update({
          where: { id: successor.id },
          data: { isPreferred: true },
        });
      }
    }
  });

  await logSupplierAction({
    adminId,
    supplierId: mapping.supplierId,
    supplierName: mapping.supplier.name,
    action: "MAPPING_DELETE",
    detail: `إلغاء ربط "${mapping.supplierProduct.name}"`,
  });

  return { ok: true };
}

/** Adds or removes catalog rows from the admin's shortlist. */
export async function setSelection(options: {
  supplierId: string;
  supplierProductIds: string[];
  selected: boolean;
  adminId: string;
}): Promise<number> {
  if (options.supplierProductIds.length === 0) return 0;

  const changed = await prisma.supplierProduct.updateMany({
    where: { id: { in: options.supplierProductIds }, supplierId: options.supplierId },
    data: { isSelected: options.selected },
  });

  const supplier = await prisma.supplier.findUnique({
    where: { id: options.supplierId },
    select: { name: true },
  });

  await logSupplierAction({
    adminId: options.adminId,
    supplierId: options.supplierId,
    supplierName: supplier?.name ?? null,
    action: "SELECTION_CHANGE",
    detail: `${options.selected ? "تحديد" : "إلغاء تحديد"} ${changed.count} عنصراً`,
  });

  return changed.count;
}

/**
 * The fulfilment snapshot for one variant, taken at order time.
 *
 * Checkout is not implemented yet; when it is, it calls this while building
 * `OrderItem` so the record carries everything a supplier purchase later needs,
 * frozen at the moment of sale.
 */
export async function getFulfilmentSnapshot(variantId: string) {
  const mapping = await prisma.productSupplierMapping.findFirst({
    where: { variantId, isPreferred: true, isEnabled: true },
    select: {
      supplierId: true,
      supplier: { select: { name: true, currency: true, status: true } },
      supplierProduct: {
        select: {
          externalProductId: true,
          externalVariantId: true,
          cost: true,
          currency: true,
          availability: true,
        },
      },
    },
  });

  if (!mapping) return null;

  return {
    supplierId: mapping.supplierId,
    supplierName: mapping.supplier.name,
    externalProductId: mapping.supplierProduct.externalProductId,
    externalVariantId: mapping.supplierProduct.externalVariantId || null,
    supplierCost: mapping.supplierProduct.cost,
    supplierCurrency: mapping.supplierProduct.currency,
    availability: mapping.supplierProduct.availability,
    supplierActive: mapping.supplier.status === "ACTIVE",
  };
}
