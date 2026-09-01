import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackButton } from "@/components/shop/back-button";
import { ProductGrid } from "@/components/shop/product-grid";
import { prisma } from "@/lib/db";
import { getStorefrontProducts } from "@/lib/queries";

type PageProps = { params: Promise<{ slug: string }> };

async function findCategory(slug: string) {
  return prisma.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true, name: true },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  return { title: category?.name ?? "الفئة غير متوفرة" };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();

  const products = await getStorefrontProducts({ categoryId: category.id });

  return (
    <div className="space-y-4">
      {/* Simple page header — no search / favorites / account controls here */}
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="truncate pb-0.5 text-lg font-bold leading-[1.6] text-fg">{category.name}</h1>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا توجد منتجات في هذه الفئة حالياً
        </p>
      )}
    </div>
  );
}
