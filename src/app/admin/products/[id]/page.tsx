import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import {
  ProductSupplierPricing,
  type VariantPricing,
} from "@/components/admin/product-supplier-pricing";
import { VariantManager } from "@/components/admin/variant-manager";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { MARKUP_TYPE_LABELS, formatMarkupBps, quotePrice, toRule } from "@/lib/suppliers/pricing";
import { getDefaultRule } from "@/lib/suppliers/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;

  const [product, categories, defaultRule] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        usageInstructions: true,
        rechargeInstructions: true,
        redemptionInstructions: true,
        helpLink: true,
        region: true,
        sortOrder: true,
        isActive: true,
        categoryId: true,
        markupType: true,
        markupValue: true,
        variants: {
          orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
          select: {
            id: true,
            name: true,
            value: true,
            price: true,
            stock: true,
            sortOrder: true,
            isActive: true,
            description: true,
            usageInstructions: true,
            rechargeInstructions: true,
            redemptionInstructions: true,
            helpLink: true,
            priceMode: true,
            markupType: true,
            markupValue: true,
            supplierMappings: {
              orderBy: [{ isPreferred: "desc" }, { createdAt: "asc" }],
              select: {
                id: true,
                isPreferred: true,
                isEnabled: true,
                supplier: {
                  select: {
                    id: true,
                    name: true,
                    currency: true,
                    rateMicros: true,
                    markupType: true,
                    markupValue: true,
                  },
                },
                supplierProduct: {
                  select: { cost: true, currency: true, availability: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    getDefaultRule(),
  ]);

  if (!product) notFound();

  const { variants, markupType, markupValue, ...productFields } = product;

  // Only supplier-backed denominations get a pricing card; a manual variant has
  // no cost to mark up and keeps the plain price field it always had.
  const pricedVariants: VariantPricing[] = variants
    .filter((variant) => variant.supplierMappings.length > 0)
    .map((variant) => {
      const preferred =
        variant.supplierMappings.find((mapping) => mapping.isPreferred && mapping.isEnabled) ??
        variant.supplierMappings[0];

      const quote = quotePrice({
        supplierCost: preferred.supplierProduct.cost,
        supplierCurrency: preferred.supplierProduct.currency || preferred.supplier.currency,
        rateMicros: preferred.supplier.rateMicros,
        // Quoted as AUTO so the card can show what the rule *would* produce,
        // even for a manually priced variant.
        priceMode: "AUTO",
        currentPrice: variant.price,
        variantRule: toRule(variant.markupType, variant.markupValue),
        productRule: toRule(markupType, markupValue),
        supplierRule: {
          type: preferred.supplier.markupType,
          value: preferred.supplier.markupValue,
        },
        defaultRule,
      });

      return {
        id: variant.id,
        name: variant.value ? `${variant.name} · ${variant.value}` : variant.name,
        price: variant.price,
        priceMode: variant.priceMode,
        markupType: variant.markupType,
        markupValue: variant.markupValue,
        ruleSource: quote.source,
        ruleLabel:
          quote.rule.type === "PERCENT"
            ? formatMarkupBps(quote.rule.value)
            : quote.rule.type === "FIXED"
              ? formatMoney(quote.rule.value)
              : MARKUP_TYPE_LABELS.NONE,
        baseCost: quote.baseCost,
        computedPrice: quote.finalPrice,
        priceIssue: quote.ok ? null : (quote.reason ?? null),
        suppliers: variant.supplierMappings.map((mapping) => ({
          mappingId: mapping.id,
          supplierId: mapping.supplier.id,
          supplierName: mapping.supplier.name,
          cost: mapping.supplierProduct.cost,
          currency: mapping.supplierProduct.currency,
          availability: mapping.supplierProduct.availability,
          isPreferred: mapping.isPreferred,
          isEnabled: mapping.isEnabled,
        })),
      };
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="truncate text-lg font-bold text-fg">{product.name}</h1>
        <Link href="/admin/products" className="ms-auto shrink-0 text-sm text-muted hover:text-fg">
          رجوع
        </Link>
      </div>

      <ProductForm product={productFields} categories={categories} />
      <VariantManager productId={product.id} variants={variants} />
      <ProductSupplierPricing
        productId={product.id}
        markupType={markupType}
        markupValue={markupValue}
        variants={pricedVariants}
      />
    </div>
  );
}
