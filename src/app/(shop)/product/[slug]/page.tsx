import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackButton } from "@/components/shop/back-button";
import { VariantGrid } from "@/components/shop/variant-grid";
import { prisma } from "@/lib/db";
import { discountedPrice, rateForProduct } from "@/lib/pricing";
import { getDiscountRates } from "@/lib/pricing-server";
import { getCurrentUser } from "@/lib/session";
import { resolveStorefrontStock } from "@/lib/suppliers/availability";

type PageProps = { params: Promise<{ slug: string }> };

async function findProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true, category: { isActive: true } },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      description: true,
      region: true,
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        select: { id: true, name: true, value: true, price: true, stock: true },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProduct(slug);
  return { title: product?.name ?? "المنتج غير متوفر" };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();

  // Pricing is resolved on the server from the signed-in customer's discount.
  const user = await getCurrentUser();
  const rates = await getDiscountRates(user?.id);
  const bps = rateForProduct(rates, product.id);
  // Supplier-backed denominations hold no local stock; their availability
  // comes from the provider instead. See resolveStorefrontStock.
  const stockById = await resolveStorefrontStock(product.variants);
  const variants = product.variants.map((variant) => ({
    ...variant,
    stock: stockById.get(variant.id) ?? variant.stock,
    finalPrice: discountedPrice(variant.price, bps),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={`/category/${product.category.slug}`} />
        <h1 className="min-w-0 truncate pb-0.5 text-lg font-bold leading-[1.6] text-fg">
          {product.name}
        </h1>
        {product.region && (
          <span className="ms-auto shrink-0 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            {product.region}
          </span>
        )}
      </div>

      {product.description && (
        <p className="text-sm leading-relaxed text-muted">{product.description}</p>
      )}

      {product.variants.length > 0 ? (
        <VariantGrid
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            image: product.image,
          }}
          variants={variants}
        />
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا توجد فئات متاحة لهذا المنتج حالياً
        </p>
      )}
    </div>
  );
}
