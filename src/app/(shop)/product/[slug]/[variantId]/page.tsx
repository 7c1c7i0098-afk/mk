import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackButton } from "@/components/shop/back-button";
import { ProductDetailsActions } from "@/components/shop/product-details-actions";
import { ProductInstructions } from "@/components/shop/product-instructions";
import { prisma } from "@/lib/db";
import { MoneyText } from "@/components/shop/money-text";
import { discountedPrice, rateForProduct } from "@/lib/pricing";
import { getDiscountRates } from "@/lib/pricing-server";
import { getCurrentUser } from "@/lib/session";
import { resolveStorefrontStock } from "@/lib/suppliers/availability";
import { initials } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string; variantId: string }> };

async function findVariant(slug: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      isActive: true,
      product: { slug, isActive: true, category: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      value: true,
      price: true,
      stock: true,
      // Per-denomination overrides; null means "inherit from the product".
      description: true,
      usageInstructions: true,
      rechargeInstructions: true,
      redemptionInstructions: true,
      helpLink: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          region: true,
          description: true,
          usageInstructions: true,
          rechargeInstructions: true,
          redemptionInstructions: true,
          helpLink: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  return variant;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, variantId } = await params;
  const variant = await findVariant(slug, variantId);
  if (!variant) return { title: "المنتج غير متوفر" };
  return { title: variant.value ?? variant.name };
}

export default async function VariantDetailsPage({ params }: PageProps) {
  const { slug, variantId } = await params;
  const variant = await findVariant(slug, variantId);
  if (!variant) notFound();

  const { product } = variant;
  const label = variant.value ?? variant.name;

  const user = await getCurrentUser();
  const rates = await getDiscountRates(user?.id);
  const finalPrice = discountedPrice(variant.price, rateForProduct(rates, product.id));

  // A supplier-backed denomination reports the provider's availability, not
  // our (always zero) local stock.
  const stockById = await resolveStorefrontStock([{ id: variant.id, stock: variant.stock }]);
  const stock = stockById.get(variant.id) ?? variant.stock;

  // Shared text lives on the product; a denomination only overrides what differs.
  const content = {
    description: variant.description ?? product.description,
    usageInstructions: variant.usageInstructions ?? product.usageInstructions,
    rechargeInstructions: variant.rechargeInstructions ?? product.rechargeInstructions,
    redemptionInstructions:
      variant.redemptionInstructions ?? product.redemptionInstructions,
    helpLink: variant.helpLink ?? product.helpLink,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={`/product/${product.slug}`} />
        <h1 className="truncate pb-0.5 text-lg font-bold leading-[1.6] text-fg">{product.name}</h1>
        {product.region && (
          <span className="ms-auto shrink-0 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            {product.region}
          </span>
        )}
      </div>

      {/* Large artwork — admin-uploaded, never recoloured or filtered */}
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl3 bg-surface ring-1 ring-line/70">
        {product.image ? (
          <Image
            src={product.image}
            alt={`${product.name} — ${label}`}
            fill
            priority
            sizes="(max-width: 640px) 92vw, 384px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-surface-2 to-surface">
            <span className="text-4xl font-semibold text-muted-2">
              {initials(product.name)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-tight text-fg">
          {label}
        </h2>
        <div className="flex items-baseline gap-2 pt-1">
          <MoneyText value={finalPrice} className="text-2xl font-bold text-brand" />
          {finalPrice < variant.price && (
            <MoneyText
              value={variant.price}
              className="text-sm text-muted-2 line-through"
            />
          )}
        </div>
      </div>

      <ProductInstructions content={content} />

      {/* Clears the fixed purchase bar below */}
      <div className="h-20" aria-hidden />

      <ProductDetailsActions
        stock={stock}
        line={{
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          variantId: variant.id,
          variantName: label,
          image: product.image,
          unitPrice: variant.price,
        }}
      />
    </div>
  );
}
