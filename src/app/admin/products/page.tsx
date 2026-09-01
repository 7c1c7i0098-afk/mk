import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductList } from "@/components/admin/product-list";
import { prisma } from "@/lib/db";

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term } },
            { slug: { contains: term } },
            { category: { name: { contains: term } } },
          ],
        }
      : undefined,
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      isActive: true,
      sortOrder: true,
      category: { select: { name: true } },
      _count: { select: { variants: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-fg">المنتجات</h1>
        <Link
          href="/admin/products/new"
          className="tap ms-auto flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="size-4" />
          منتج جديد
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={term}
          placeholder="ابحث عن منتج…"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none focus:border-brand/60"
        />
        <button
          type="submit"
          className="tap rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg"
        >
          بحث
        </button>
      </form>

      <ProductList products={products} />
    </div>
  );
}
